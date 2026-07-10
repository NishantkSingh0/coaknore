package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/pms/backend/internal/config"
)

// llmCacheEntry stores a completed (or in-progress) LLM response, used to
// deduplicate identical calls that happen close together in time.
type llmCacheEntry struct {
	response string
	err      error
	expires  time.Time
	done     chan struct{}
}

type AIService struct {
	db *sql.DB

	// llmMu guards llmInFlight, which deduplicates identical/near-identical
	// LLM calls (same prompt) that arrive within a short window of each
	// other. This protects against duplicate calls caused by frontend
	// double-submits, proxy retries, or repeated invocations elsewhere in
	// the request path, which would otherwise burn through Groq's
	// rate limit for no benefit.
	llmMu       sync.Mutex
	llmInFlight map[string]*llmCacheEntry
}

// llmDedupWindow controls how long a completed response is kept around so
// that an immediately-following duplicate request can reuse it instead of
// calling the LLM again.
const llmDedupWindow = 15 * time.Second

type ChatRequest struct {
	Message string `json:"message"`
}

type ChatResponse struct {
	Response string `json:"response"`
}

type SchemaInfo struct {
	Tables []TableInfo `json:"tables"`
	Enums  []EnumInfo  `json:"enums"`
}

type EnumInfo struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}

type TableInfo struct {
	Name        string       `json:"name"`
	Columns     []ColumnInfo `json:"columns"`
	Description string       `json:"description"`
}

type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Nullable     bool   `json:"nullable"`
	DefaultValue string `json:"default_value,omitempty"`
	Description  string `json:"description,omitempty"`
}

type LLMRequest struct {
	Schema   string   `json:"schema"`
	Question string   `json:"question"`
	History  []string `json:"history,omitempty"`
}

type LLMResponse struct {
	SQL string `json:"sql"`
}

type SQLValidationResult struct {
	Valid bool   `json:"valid"`
	SQL   string `json:"sql"`
	Error string `json:"error,omitempty"`
}

const (
	maxRetries = 3

	// Groq model to use for all completions
	groqModel = "meta-llama/llama-4-scout-17b-16e-instruct"

	// Groq API endpoint (OpenAI-compatible chat completions)
	groqAPIURL = "https://api.groq.com/openai/v1/chat/completions"
)

func NewAIService(db *sql.DB) *AIService {
	return &AIService{
		db:          db,
		llmInFlight: make(map[string]*llmCacheEntry),
	}
}

// GetDatabaseSchema extracts the complete database schema
func (s *AIService) GetDatabaseSchema(ctx context.Context) (*SchemaInfo, error) {
	schema := &SchemaInfo{}

	// Get all enum types in the database
	enumQuery := `
		SELECT t.typname as enum_name,
			   string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) as enum_values
		FROM pg_type t
		JOIN pg_enum e ON t.oid = e.enumtypid
		WHERE t.typname LIKE '%_status' OR t.typname LIKE '%_type'
		GROUP BY t.typname
		ORDER BY t.typname
	`

	enumRows, err := s.db.QueryContext(ctx, enumQuery)
	if err != nil {
		log.Printf("AI Service: Failed to query enums (non-critical): %v", err)
	} else {
		defer enumRows.Close()
		for enumRows.Next() {
			var enumName, enumValues string
			if err := enumRows.Scan(&enumName, &enumValues); err != nil {
				continue
			}
			schema.Enums = append(schema.Enums, EnumInfo{
				Name:   enumName,
				Values: strings.Split(enumValues, ","),
			})
		}
	}

	// Get all tables in the public schema
	query := `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, fmt.Errorf("failed to scan table name: %w", err)
		}
		tables = append(tables, tableName)
	}

	// Get column information for each table
	for _, table := range tables {
		tableInfo := TableInfo{
			Name: table,
		}

		colQuery := `
			SELECT 
				column_name,
				data_type,
				is_nullable,
				column_default,
				'' as description
			FROM information_schema.columns
			WHERE table_schema = 'public' 
			AND table_name = $1
			ORDER BY ordinal_position
		`

		colRows, err := s.db.QueryContext(ctx, colQuery, table)
		if err != nil {
			return nil, fmt.Errorf("failed to query columns for table %s: %w", table, err)
		}

		for colRows.Next() {
			var colName, dataType, isNullable, description string
			var defaultValue sql.NullString
			if err := colRows.Scan(&colName, &dataType, &isNullable, &defaultValue, &description); err != nil {
				colRows.Close()
				return nil, fmt.Errorf("failed to scan column for table %s: %w", table, err)
			}

			colInfo := ColumnInfo{
				Name:     colName,
				Type:     dataType,
				Nullable: isNullable == "YES",
			}

			if defaultValue.Valid {
				colInfo.DefaultValue = defaultValue.String
			}

			if description != "" {
				colInfo.Description = description
			}

			tableInfo.Columns = append(tableInfo.Columns, colInfo)
		}
		colRows.Close()

		schema.Tables = append(schema.Tables, tableInfo)
	}

	return schema, nil
}

// ValidateSQL validates that the SQL is a safe SELECT query
func (s *AIService) ValidateSQL(sql string) *SQLValidationResult {
	// Trim whitespace
	sql = strings.TrimSpace(sql)

	// Check if it starts with SELECT (case-insensitive)
	if !strings.HasPrefix(strings.ToUpper(sql), "SELECT") {
		return &SQLValidationResult{
			Valid: false,
			SQL:   sql,
			Error: "SQL must start with SELECT",
		}
	}

	// Check for multiple statements (semicolon followed by another statement)
	if strings.Contains(sql, ";") {
		// Allow trailing semicolon but not multiple statements
		trimmed := strings.TrimSpace(sql)
		if strings.HasSuffix(trimmed, ";") {
			// Trailing semicolon is OK, remove it
			sql = strings.TrimSuffix(trimmed, ";")
		} else {
			// Semicolon in the middle means multiple statements
			return &SQLValidationResult{
				Valid: false,
				SQL:   sql,
				Error: "Multiple statements are not allowed",
			}
		}
	}

	// Check for dangerous keywords
	dangerousKeywords := []string{
		"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
		"CREATE", "EXECUTE", "CALL", "COPY", "DO", "GRANT", "REVOKE",
	}

	upperSQL := strings.ToUpper(sql)
	for _, keyword := range dangerousKeywords {
		// Use word boundary to avoid false positives
		pattern := `\b` + keyword + `\b`
		matched, _ := regexp.MatchString(pattern, upperSQL)
		if matched {
			return &SQLValidationResult{
				Valid: false,
				SQL:   sql,
				Error: fmt.Sprintf("Dangerous keyword '%s' detected", keyword),
			}
		}
	}

	// Check for comments (both -- and /* */)
	if strings.Contains(sql, "--") || strings.Contains(sql, "/*") {
		return &SQLValidationResult{
			Valid: false,
			SQL:   sql,
			Error: "SQL comments are not allowed",
		}
	}

	// Check for transaction commands
	transactionKeywords := []string{"BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT"}
	for _, keyword := range transactionKeywords {
		pattern := `\b` + keyword + `\b`
		matched, _ := regexp.MatchString(pattern, upperSQL)
		if matched {
			return &SQLValidationResult{
				Valid: false,
				SQL:   sql,
				Error: fmt.Sprintf("Transaction command '%s' is not allowed", keyword),
			}
		}
	}

	return &SQLValidationResult{
		Valid: true,
		SQL:   sql,
	}
}

// GenerateSQLWithLLM calls the LLM to generate SQL from natural language
func (s *AIService) GenerateSQLWithLLM(ctx context.Context, schema *SchemaInfo, question string, history []string) (string, error) {
	schemaJSON, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal schema: %w", err)
	}

	// Build enum information for the prompt
	var enumInfo string
	if len(schema.Enums) > 0 {
		enumInfo = "\nENUM VALUES (use these exact values for status/type columns):\n"
		for _, enum := range schema.Enums {
			enumInfo += fmt.Sprintf("- %s: %s\n", enum.Name, strings.Join(enum.Values, ", "))
		}
	}

	prompt := fmt.Sprintf(`You are a SQL expert for a Project Management System. Your task is to generate SELECT queries to answer questions about the database.

DATABASE SCHEMA:
%s
%s

IMPORTANT RULES:
1. Generate ONLY SELECT statements - never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, or any other data modification commands
2. Use proper JOIN syntax when querying related tables
3. Use appropriate WHERE clauses to filter data
4. Use ORDER BY for sorted results when relevant
5. Use LIMIT to prevent excessive result sets (default to 100 rows unless specified otherwise)
6. Use proper date/time functions for date comparisons
7. CRITICAL: Use the exact enum values listed above for status/type columns - do not guess or make up values
8. Return ONLY the SQL query, no explanations or markdown formatting
9. Do not include comments in the SQL
10. Do not use semicolons at the end of the query

QUESTION: %s

Generate the SQL query:`, string(schemaJSON), enumInfo, question)

	// Call Groq API (with automatic key fallback)
	response, err := s.callGroqAPI(ctx, prompt)
	if err != nil {
		return "", fmt.Errorf("failed to call Groq API: %w", err)
	}

	// Extract SQL from response (remove markdown code blocks if present)
	sql := s.extractSQLFromResponse(response)

	return sql, nil
}

// getGroqAPIKeys returns the list of configured Groq API keys, in order,
// skipping any that are empty/unset.
func (s *AIService) getGroqAPIKeys() []string {
	candidates := []string{
		config.App.GroqAPIKey1,
		config.App.GroqAPIKey2,
		config.App.GroqAPIKey3,
		config.App.GroqAPIKey4,
		config.App.GroqAPIKey5,
	}

	keys := make([]string, 0, len(candidates))
	for _, k := range candidates {
		if strings.TrimSpace(k) != "" {
			keys = append(keys, k)
		}
	}
	return keys
}

// callGroqAPI is the public entry point for calling the LLM. It deduplicates
// identical prompts that arrive within llmDedupWindow of each other (see
// dedupCallGroqAPI), then delegates to callGroqAPIRaw, which does the actual
// HTTP call with key fallback.
func (s *AIService) callGroqAPI(ctx context.Context, prompt string) (string, error) {
	return s.dedupCallGroqAPI(ctx, prompt)
}

// dedupCallGroqAPI ensures that if the same prompt is requested multiple
// times in quick succession (e.g. a duplicate request from the frontend, a
// proxy retry, or an accidental double-call somewhere upstream), only ONE
// actual Groq API call is made. Concurrent callers wait for the in-flight
// call to finish and share its result; callers that arrive shortly after
// a call has completed reuse the cached response instead of re-calling
// the API.
func (s *AIService) dedupCallGroqAPI(ctx context.Context, prompt string) (string, error) {
	key := hashPrompt(prompt)
	now := time.Now()

	s.llmMu.Lock()
	if entry, ok := s.llmInFlight[key]; ok {
		if entry.done == nil {
			// A completed entry still within its cache window - reuse it.
			if now.Before(entry.expires) {
				s.llmMu.Unlock()
				log.Printf("AI Service: Reusing cached LLM response for duplicate request (skipping Groq call)")
				return entry.response, entry.err
			}
			// Expired - fall through to start a fresh call.
			delete(s.llmInFlight, key)
		} else {
			// A call for this exact prompt is already in flight - wait for it.
			doneCh := entry.done
			s.llmMu.Unlock()
			log.Printf("AI Service: Waiting for in-flight duplicate LLM request instead of calling Groq again")
			select {
			case <-doneCh:
				s.llmMu.Lock()
				result := s.llmInFlight[key]
				s.llmMu.Unlock()
				if result != nil {
					return result.response, result.err
				}
				// Shouldn't normally happen, but fall back to a fresh call.
			case <-ctx.Done():
				return "", ctx.Err()
			}
			s.llmMu.Lock()
		}
	}

	// No usable cached/in-flight entry - claim this key ourselves.
	doneCh := make(chan struct{})
	s.llmInFlight[key] = &llmCacheEntry{done: doneCh}
	s.llmMu.Unlock()

	response, err := s.callGroqAPIRaw(ctx, prompt)

	s.llmMu.Lock()
	s.llmInFlight[key] = &llmCacheEntry{
		response: response,
		err:      err,
		expires:  time.Now().Add(llmDedupWindow),
	}
	s.llmMu.Unlock()
	close(doneCh)

	return response, err
}

// hashPrompt returns a stable, fixed-size key for a prompt string.
func hashPrompt(prompt string) string {
	sum := sha256.Sum256([]byte(prompt))
	return hex.EncodeToString(sum[:])
}

// callGroqAPIRaw makes a request to the Groq API, trying each configured API
// key in order (GROQ_API_KEY1 .. GROQ_API_KEY5) until one succeeds. This
// provides automatic fallback if a key is rate-limited, invalid, or
// otherwise failing.
func (s *AIService) callGroqAPIRaw(ctx context.Context, prompt string) (string, error) {
	keys := s.getGroqAPIKeys()
	if len(keys) == 0 {
		log.Printf("AI Service: No GROQ_API_KEY1..5 configured")
		return "", fmt.Errorf("no Groq API keys configured")
	}

	log.Printf("AI Service: Calling Groq API (model=%s) with prompt length: %d, keys available: %d", groqModel, len(prompt), len(keys))

	requestBody := map[string]interface{}{
		"model": groqModel,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": 0.1,
		"top_p":       1,
		"max_tokens":  2048,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		log.Printf("AI Service: Failed to marshal request: %v", err)
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	var lastErr error

	for i, apiKey := range keys {
		keyLabel := fmt.Sprintf("GROQ_API_KEY%d", i+1)

		req, err := http.NewRequestWithContext(ctx, "POST", groqAPIURL, bytes.NewBuffer(jsonBody))
		if err != nil {
			log.Printf("AI Service: Failed to create request for %s: %v", keyLabel, err)
			lastErr = fmt.Errorf("failed to create request: %w", err)
			continue
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+apiKey)

		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("AI Service: %s request failed: %v", keyLabel, err)
			lastErr = fmt.Errorf("failed to execute request: %w", err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			log.Printf("AI Service: %s returned status %d: %s", keyLabel, resp.StatusCode, string(body))
			lastErr = fmt.Errorf("Groq API (%s) returned status %d: %s", keyLabel, resp.StatusCode, string(body))

			// On auth errors, rate limits, or server errors, try the next key.
			if resp.StatusCode == http.StatusUnauthorized ||
				resp.StatusCode == http.StatusForbidden ||
				resp.StatusCode == http.StatusTooManyRequests ||
				resp.StatusCode >= http.StatusInternalServerError {
				continue
			}
			// For other client errors (e.g. bad request), no point retrying
			// with a different key since the payload itself is the problem.
			return "", lastErr
		}

		var groqResponse struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}

		decodeErr := json.NewDecoder(resp.Body).Decode(&groqResponse)
		resp.Body.Close()

		if decodeErr != nil {
			log.Printf("AI Service: Failed to decode response from %s: %v", keyLabel, decodeErr)
			lastErr = fmt.Errorf("failed to decode response: %w", decodeErr)
			continue
		}

		if len(groqResponse.Choices) == 0 {
			log.Printf("AI Service: No response content from Groq (%s)", keyLabel)
			lastErr = fmt.Errorf("no response content from Groq")
			continue
		}

		response := groqResponse.Choices[0].Message.Content
		log.Printf("AI Service: %s succeeded, response length: %d", keyLabel, len(response))
		return response, nil
	}

	log.Printf("AI Service: All Groq API keys failed")
	if lastErr != nil {
		return "", fmt.Errorf("all Groq API keys failed, last error: %w", lastErr)
	}
	return "", fmt.Errorf("all Groq API keys failed")
}

// extractSQLFromResponse extracts SQL from LLM response
func (s *AIService) extractSQLFromResponse(response string) string {
	// Remove markdown code blocks if present
	response = strings.TrimSpace(response)

	// Remove ```sql and ``` markers
	response = strings.ReplaceAll(response, "```sql", "")
	response = strings.ReplaceAll(response, "```", "")

	// Remove any leading/trailing whitespace
	response = strings.TrimSpace(response)

	return response
}

// ExecuteQuery executes a validated SQL query
func (s *AIService) ExecuteQuery(ctx context.Context, sql string) ([]map[string]interface{}, error) {
	// Validate again before execution (defense in depth)
	validation := s.ValidateSQL(sql)
	if !validation.Valid {
		return nil, fmt.Errorf("SQL validation failed: %s", validation.Error)
	}

	rows, err := s.db.QueryContext(ctx, sql)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var results []map[string]interface{}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if val == nil {
				row[col] = nil
			} else {
				// Convert to appropriate type
				switch v := val.(type) {
				case []byte:
					row[col] = string(v)
				default:
					row[col] = v
				}
			}
		}
		results = append(results, row)
	}

	return results, nil
}

// SummarizeResults uses LLM to summarize query results
func (s *AIService) SummarizeResults(ctx context.Context, question string, sql string, results []map[string]interface{}) (string, error) {
	resultsJSON, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal results: %w", err)
	}

	prompt := fmt.Sprintf(`You are a helpful business assistant for a Project Management System. 

ORIGINAL QUESTION: %s

SQL QUERY EXECUTED:
%s

QUERY RESULTS:
%s

TASK: Provide a clear, professional, and concise summary of the results in business language. 
- Highlight key information and numbers
- Mention any relevant patterns or insights
- If data is incomplete or assumptions were made, mention them
- Do not include raw SQL or technical details
- Keep the response conversational and easy to understand

Summary:`, question, sql, string(resultsJSON))

	// Call Groq API (with automatic key fallback)
	response, err := s.callGroqAPI(ctx, prompt)
	if err != nil {
		return "", fmt.Errorf("failed to call Groq API for summarization: %w", err)
	}

	return response, nil
}

// ProcessChat handles the complete chat flow
func (s *AIService) ProcessChat(ctx context.Context, message string) (string, error) {
	log.Printf("AI Service: Processing chat message: %s", message)

	// Get database schema
	schema, err := s.GetDatabaseSchema(ctx)
	if err != nil {
		log.Printf("AI Service: Failed to get database schema: %v", err)
		return "", fmt.Errorf("failed to get database schema: %w", err)
	}
	log.Printf("AI Service: Retrieved schema with %d tables", len(schema.Tables))

	// Check if query requires multi-step processing
	requiresMultiStep := s.requiresMultiStepProcessing(message, schema)
	log.Printf("AI Service: Multi-step processing: %v", requiresMultiStep)

	if requiresMultiStep {
		return s.processMultiStepQuery(ctx, message, schema)
	}

	// Single-step processing
	return s.processSingleStepQuery(ctx, message, schema)
}

// requiresMultiStepProcessing determines if a query needs multiple steps
func (s *AIService) requiresMultiStepProcessing(message string, schema *SchemaInfo) bool {
	// Check for patterns that indicate multi-step queries
	multiStepPatterns := []string{
		"assigned to", "tasks for", "working on", "projects by",
		"employee", "department", "team", "who is",
	}

	messageLower := strings.ToLower(message)
	for _, pattern := range multiStepPatterns {
		if strings.Contains(messageLower, pattern) {
			return true
		}
	}

	return false
}

// processMultiStepQuery handles complex queries requiring multiple steps
func (s *AIService) processMultiStepQuery(ctx context.Context, message string, schema *SchemaInfo) (string, error) {
	log.Printf("AI Service: Starting multi-step query processing")

	// Step 1: Analyze the query and break it into steps
	steps, err := s.breakDownQuery(ctx, message, schema)
	if err != nil {
		log.Printf("AI Service: Failed to break down query: %v", err)
		// Fall back to single-step processing
		return s.processSingleStepQuery(ctx, message, schema)
	}

	log.Printf("AI Service: Query broken into %d steps", len(steps))

	// Step 2: Execute each step sequentially
	var allResults []map[string]interface{}
	var stepDescriptions []string

	for i, step := range steps {
		log.Printf("AI Service: Executing step %d: %s", i+1, step.Description)

		// Generate SQL for this step
		sql, err := s.GenerateSQLWithLLM(ctx, schema, step.Query, []string{})
		if err != nil {
			log.Printf("AI Service: Step %d SQL generation failed: %v", i+1, err)
			continue
		}

		// Validate SQL
		validation := s.ValidateSQL(sql)
		if !validation.Valid {
			log.Printf("AI Service: Step %d SQL validation failed: %s", i+1, validation.Error)
			continue
		}

		// Execute query
		results, err := s.ExecuteQuery(ctx, sql)
		if err != nil {
			log.Printf("AI Service: Step %d execution failed: %v", i+1, err)
			continue
		}

		log.Printf("AI Service: Step %d succeeded with %d results", i+1, len(results))
		allResults = append(allResults, results...)
		stepDescriptions = append(stepDescriptions, step.Description)
	}

	if len(allResults) == 0 {
		return "I couldn't find the information you're looking for. Let me try a different approach.", nil
	}

	// Step 3: Format the combined results
	return s.formatMultiStepResults(allResults, stepDescriptions), nil
}

// QueryStep represents a single step in a multi-step query
type QueryStep struct {
	Description string
	Query       string
}

// breakDownQuery breaks a complex query into multiple steps
func (s *AIService) breakDownQuery(ctx context.Context, message string, schema *SchemaInfo) ([]QueryStep, error) {
	prompt := fmt.Sprintf(`You are a query analyzer for a Project Management System. Break down the following user question into 2-3 sequential steps to retrieve the information.

DATABASE SCHEMA:
%s

USER QUESTION: %s

Analyze the question and break it into steps. For each step:
1. Identify what needs to be found first (e.g., employee ID, department ID)
2. Identify what needs to be found second (e.g., tasks assigned to that employee)
3. Identify what needs to be found third (e.g., project details for those tasks)

Return your answer in this exact format:
Step 1: [description of what to find]
Query 1: [natural language query for step 1]

Step 2: [description of what to find]
Query 2: [natural language query for step 2]

Step 3: [description of what to find]
Query 3: [natural language query for step 3]

If the question can be answered in 1 step, just provide Step 1 and Query 1.`, schema, message)

	response, err := s.callGroqAPI(ctx, prompt)
	if err != nil {
		return nil, err
	}

	return s.parseQuerySteps(response)
}

// parseQuerySteps parses the LLM response into QueryStep objects
func (s *AIService) parseQuerySteps(response string) ([]QueryStep, error) {
	var steps []QueryStep
	lines := strings.Split(response, "\n")

	var currentStep *QueryStep
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "Step") && strings.Contains(line, ":") {
			if currentStep != nil {
				steps = append(steps, *currentStep)
			}
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				currentStep = &QueryStep{Description: strings.TrimSpace(parts[1])}
			}
		} else if strings.HasPrefix(line, "Query") && strings.Contains(line, ":") && currentStep != nil {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				currentStep.Query = strings.TrimSpace(parts[1])
			}
		}
	}

	if currentStep != nil {
		steps = append(steps, *currentStep)
	}

	return steps, nil
}

// processSingleStepQuery handles simple single-step queries
func (s *AIService) processSingleStepQuery(ctx context.Context, message string, schema *SchemaInfo) (string, error) {
	// Generate SQL with LLM
	sql, err := s.GenerateSQLWithLLM(ctx, schema, message, []string{})
	if err != nil {
		log.Printf("AI Service: Failed to generate SQL: %v", err)
		return "", fmt.Errorf("failed to generate SQL: %w", err)
	}
	log.Printf("AI Service: Generated SQL: %s", sql)

	// Validate SQL
	validation := s.ValidateSQL(sql)
	log.Printf("AI Service: SQL validation result: Valid=%v, Error=%s", validation.Valid, validation.Error)
	if !validation.Valid {
		log.Printf("AI Service: SQL validation failed, attempting regeneration")
		// Try to regenerate with error feedback
		for i := 0; i < maxRetries; i++ {
			errorPrompt := fmt.Sprintf(`Previous SQL was invalid: %s

Please regenerate a valid SELECT query that answers: %s

Remember: Only SELECT statements, no data modification commands.`, validation.Error, message)

			sql, err = s.GenerateSQLWithLLM(ctx, schema, errorPrompt, []string{})
			if err != nil {
				log.Printf("AI Service: Regeneration attempt %d failed: %v", i+1, err)
				continue
			}

			validation = s.ValidateSQL(sql)
			log.Printf("AI Service: Regeneration attempt %d validation: Valid=%v", i+1, validation.Valid)
			if validation.Valid {
				break
			}
		}

		if !validation.Valid {
			log.Printf("AI Service: All regeneration attempts failed, returning error to user")
			return "I couldn't retrieve the requested information due to an internal query error.", nil
		}
	}

	// Execute query with retry logic
	var results []map[string]interface{}
	var execErr error

	for i := 0; i < maxRetries; i++ {
		log.Printf("AI Service: Query execution attempt %d", i+1)
		results, execErr = s.ExecuteQuery(ctx, sql)
		if execErr == nil {
			log.Printf("AI Service: Query execution succeeded, returned %d rows", len(results))
			break
		}

		log.Printf("AI Service: Query execution attempt %d failed: %v", i+1, execErr)

		// If execution failed, ask LLM to regenerate
		errorPrompt := fmt.Sprintf(`Previous SQL failed to execute: %s

Please regenerate a valid SELECT query that answers: %s

Make sure to use correct table and column names from the schema.`, execErr.Error(), message)

		sql, err = s.GenerateSQLWithLLM(ctx, schema, errorPrompt, []string{})
		if err != nil {
			log.Printf("AI Service: SQL regeneration after execution error failed: %v", err)
			continue
		}

		validation = s.ValidateSQL(sql)
		if !validation.Valid {
			log.Printf("AI Service: Regenerated SQL failed validation")
			continue
		}
		log.Printf("AI Service: Regenerated SQL: %s", sql)
	}

	if execErr != nil {
		log.Printf("AI Service: Query execution failed after %d retries: %v", maxRetries, execErr)
		return "I couldn't retrieve the requested information due to an internal query error.", nil
	}

	// Return results directly without summarization for faster response
	log.Printf("AI Service: Returning %d results directly", len(results))
	return s.formatResultsDirectly(results), nil
}

// formatMultiStepResults formats results from multi-step queries
func (s *AIService) formatMultiStepResults(results []map[string]interface{}, descriptions []string) string {
	if len(results) == 0 {
		return "I couldn't find the information you're looking for."
	}

	var response strings.Builder
	response.WriteString("I've gathered the information you requested:\n\n")

	// Group results by step if possible
	for i, result := range results {
		if i < len(descriptions) {
			response.WriteString(fmt.Sprintf("%s:\n", descriptions[i]))
		}

		var parts []string
		for key, value := range result {
			if value == nil || value == "" {
				continue
			}
			if key == "id" || strings.Contains(key, "_id") {
				continue
			}
			valueStr := fmt.Sprintf("%v", value)
			if strings.Contains(key, "status") {
				valueStr = strings.ReplaceAll(valueStr, "_", " ")
			}
			parts = append(parts, fmt.Sprintf("%s: %s", key, valueStr))
		}

		if len(parts) > 0 {
			response.WriteString(fmt.Sprintf("  %s\n\n", strings.Join(parts, ", ")))
		}
	}

	return response.String()
}

// formatResultsDirectly formats query results as a simple text response
func (s *AIService) formatResultsDirectly(results []map[string]interface{}) string {
	if len(results) == 0 {
		return "There are no items matching your request at the moment."
	}

	if len(results) == 1 {
		return s.formatSingleResult(results[0])
	}

	return s.formatMultipleResults(results)
}

// formatSingleResult formats a single result in natural language
func (s *AIService) formatSingleResult(row map[string]interface{}) string {
	var parts []string

	// Common field mappings for natural language
	fieldMap := map[string]string{
		"project_name":  "project",
		"client_name":   "client",
		"employee_name": "employee",
		"department":    "department",
		"task_name":     "task",
		"issue_title":   "issue",
		"status":        "status",
		"priority":      "priority",
		"created_at":    "created",
		"updated_at":    "updated",
	}

	for key, value := range row {
		if value == nil || value == "" {
			continue
		}

		// Skip technical fields
		if key == "id" || strings.Contains(key, "_id") {
			continue
		}

		// Get human-readable field name
		fieldName := key
		if mapped, ok := fieldMap[key]; ok {
			fieldName = mapped
		}

		// Format the value
		valueStr := fmt.Sprintf("%v", value)
		if strings.Contains(fieldName, "status") {
			valueStr = strings.ReplaceAll(valueStr, "_", " ")
		}

		parts = append(parts, fmt.Sprintf("%s: %s", fieldName, valueStr))
	}

	if len(parts) == 0 {
		return "There is one item, but the details aren't available."
	}

	return fmt.Sprintf("Here's what I found: %s.", strings.Join(parts, ", "))
}

// formatMultipleResults formats multiple results in natural language
func (s *AIService) formatMultipleResults(results []map[string]interface{}) string {
	// For multiple results, show a summary
	var response strings.Builder
	response.WriteString(fmt.Sprintf("There are %d items. Here's an overview:\n\n", len(results)))

	// Show first 5 results to avoid overwhelming output
	maxResults := 5
	if len(results) < maxResults {
		maxResults = len(results)
	}

	for i := 0; i < maxResults; i++ {
		row := results[i]
		var keyFields []string

		// Extract key fields (name, title, status, etc.)
		for key, value := range row {
			if value == nil || value == "" {
				continue
			}

			// Focus on important fields
			if strings.Contains(key, "name") || strings.Contains(key, "title") ||
				strings.Contains(key, "status") || strings.Contains(key, "priority") {
				valueStr := fmt.Sprintf("%v", value)
				if strings.Contains(key, "status") {
					valueStr = strings.ReplaceAll(valueStr, "_", " ")
				}
				keyFields = append(keyFields, valueStr)
			}
		}

		if len(keyFields) > 0 {
			response.WriteString(fmt.Sprintf("• %s\n", strings.Join(keyFields, " - ")))
		}
	}

	if len(results) > maxResults {
		response.WriteString(fmt.Sprintf("\n... and %d more items.", len(results)-maxResults))
	}

	return response.String()
}
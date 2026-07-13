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

type chatIntent string

const (
	intentGreeting     chatIntent = "greeting"
	intentHelp         chatIntent = "help"
	intentDataQuestion chatIntent = "data_question"
	intentSmallTalk    chatIntent = "small_talk"
)

type entityMatch struct {
	ID         string
	Name       string
	Descriptor string
	Score      float64
}

type resultColumn struct {
	Key   string
	Label string
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

// ExecuteQueryWithArgs executes a validated read-only query with bind parameters.
func (s *AIService) ExecuteQueryWithArgs(ctx context.Context, sql string, args ...interface{}) ([]map[string]interface{}, error) {
	validation := s.ValidateSQL(sql)
	if !validation.Valid {
		return nil, fmt.Errorf("SQL validation failed: %s", validation.Error)
	}

	rows, err := s.db.QueryContext(ctx, sql, args...)
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
				continue
			}
			if bytesVal, ok := val.([]byte); ok {
				row[col] = string(bytesVal)
				continue
			}
			row[col] = val
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read rows: %w", err)
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

func classifyChatIntent(message string) chatIntent {
	normalized := normalizeMessage(message)
	if normalized == "" {
		return intentSmallTalk
	}

	greetings := map[string]bool{
		"hi": true, "hii": true, "hello": true, "hey": true, "heyy": true,
		"good morning": true, "good afternoon": true, "good evening": true,
		"namaste": true,
	}
	if greetings[normalized] {
		return intentGreeting
	}

	words := strings.Fields(normalized)
	if len(words) <= 3 {
		for _, word := range words {
			if word == "help" || word == "commands" || word == "examples" {
				return intentHelp
			}
		}
		if !looksLikeDataQuestion(normalized) {
			return intentSmallTalk
		}
	}

	return intentDataQuestion
}

func looksLikeDataQuestion(message string) bool {
	keywords := []string{
		"employee", "employees", "project", "projects", "task", "tasks",
		"report", "reports", "routing", "material", "materials", "issue",
		"issues", "rework", "notification", "notifications", "department",
		"departments", "production", "approval", "approvals", "summary",
		"working", "assigned", "delayed", "pending", "overdue", "idle",
	}
	for _, keyword := range keywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

func normalizeMessage(message string) string {
	message = strings.ToLower(strings.TrimSpace(message))
	replacer := strings.NewReplacer(
		"`", " ", "'", " ", "\"", " ", ".", " ", ",", " ", "?", " ",
		"!", " ", ":", " ", ";", " ", "(", " ", ")", " ",
	)
	return strings.Join(strings.Fields(replacer.Replace(message)), " ")
}

func cleanEntityName(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Trim(value, "`'\".,?!:;")
	value = regexp.MustCompile(`(?i)\b(today|right now|currently|now|please|pls|project|employee)\b`).ReplaceAllString(value, " ")
	value = strings.Join(strings.Fields(value), " ")
	if len(value) > 3 && strings.HasSuffix(strings.ToLower(value), "s") {
		value = strings.TrimSuffix(value, "s")
	}
	return value
}

func handledResponse(response string, err error) (string, bool, error) {
	return response, true, err
}

func extractByRegex(message string, patterns ...string) string {
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(message)
		if len(matches) > 1 {
			return cleanEntityName(matches[1])
		}
	}
	return ""
}

func (s *AIService) processBusinessQuery(ctx context.Context, message string) (string, bool, error) {
	normalized := normalizeMessage(message)

	if strings.Contains(normalized, "last work") {
		name := extractByRegex(message, `(?i)(?:what is|what's|whats|show|get|tell me)?\s*(.+?)\s+(?:last work|latest work)`)
		if name != "" {
			response, err := s.answerEmployeeLastWork(ctx, name)
			return response, true, err
		}
	}

	if strings.Contains(normalized, "working on") {
		name := extractByRegex(message, `(?i)(?:what is|what's|whats|what)\s+(.+?)\s+working on`, `(?i)is\s+(.+?)\s+working on`)
		if name != "" {
			response, err := s.answerEmployeeCurrentWork(ctx, name)
			return response, true, err
		}
	}

	if strings.Contains(normalized, "assigned to") && strings.Contains(normalized, "project") {
		name := extractByRegex(message, `(?i)project\s+is\s+(.+?)\s+assigned to`, `(?i)which project is\s+(.+?)\s+assigned to`)
		if name != "" {
			response, err := s.answerEmployeeCurrentWork(ctx, name)
			return response, true, err
		}
	}

	switch {
	case strings.Contains(normalized, "not submitted") && strings.Contains(normalized, "today") && strings.Contains(normalized, "report"):
		return handledResponse(s.answerStandardQuery(ctx, "Employees Missing Today's Report", "Everyone below is active but has no daily report for today.", []resultColumn{{"employee", "Employee"}, {"department", "Department"}, {"email", "Email"}}, `
			SELECT CONCAT(e.first_name, ' ', e.last_name) AS employee,
			       COALESCE(d.name, '-') AS department,
			       e.email
			FROM employees e
			LEFT JOIN departments d ON d.id = e.department_id
			LEFT JOIN daily_reports dr ON dr.submitted_by = e.id AND dr.report_date = CURRENT_DATE
			WHERE e.is_active = TRUE AND dr.id IS NULL
			ORDER BY employee
		`, "Everyone has submitted today's report."))
	case strings.Contains(normalized, "currently idle") || strings.Contains(normalized, "idle employees"):
		return handledResponse(s.answerStandardQuery(ctx, "Currently Idle Employees", "These active employees do not have an in-progress assigned task right now.", []resultColumn{{"employee", "Employee"}, {"department", "Department"}, {"email", "Email"}}, `
			SELECT CONCAT(e.first_name, ' ', e.last_name) AS employee,
			       COALESCE(d.name, '-') AS department,
			       e.email
			FROM employees e
			LEFT JOIN departments d ON d.id = e.department_id
			WHERE e.is_active = TRUE
			  AND NOT EXISTS (
			    SELECT 1
			    FROM task_employee_assignments tea
			    JOIN department_tasks t ON t.id = tea.task_id
			    WHERE tea.employee_id = e.id AND t.status = 'in_progress'
			  )
			ORDER BY employee
		`, "No idle employees found."))
	case strings.Contains(normalized, "on hold"):
		return handledResponse(s.answerStandardQuery(ctx, "Employees Or Work Currently On Hold", "These tasks/projects are marked as hold or on-hold.", []resultColumn{{"project_name", "Project"}, {"task", "Task"}, {"employee", "Employee"}, {"department", "Department"}, {"status", "Status"}}, `
			SELECT p.project_name,
			       COALESCE(t.title, 'Department task') AS task,
			       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '-') AS employee,
			       COALESCE(d.name, '-') AS department,
			       t.status::text AS status
			FROM department_tasks t
			JOIN projects p ON p.id = t.project_id
			LEFT JOIN departments d ON d.id = t.department_id
			LEFT JOIN task_employee_assignments tea ON tea.task_id = t.id
			LEFT JOIN employees e ON e.id = tea.employee_id
			WHERE t.status IN ('hold', 'issue_hold', 'on_hold')
			ORDER BY t.updated_at DESC
			LIMIT 50
		`, "No tasks are currently on hold."))
	case strings.Contains(normalized, "projects") && strings.Contains(normalized, "delayed"):
		return handledResponse(s.answerStandardQuery(ctx, "Delayed Projects", "These projects have passed their delivery date and are not completed or archived.", []resultColumn{{"project_name", "Project"}, {"client_name", "Client"}, {"status", "Status"}, {"delivery_date", "Delivery Date"}}, `
			SELECT project_name, client_name, status::text AS status, delivery_date
			FROM projects
			WHERE delivery_date < CURRENT_DATE AND status NOT IN ('completed', 'archived')
			ORDER BY delivery_date ASC
			LIMIT 50
		`, "No delayed projects found."))
	case strings.Contains(normalized, "projects") && strings.Contains(normalized, "due this week"):
		return handledResponse(s.answerStandardQuery(ctx, "Projects Due This Week", "These projects have a delivery date within the current week.", []resultColumn{{"project_name", "Project"}, {"client_name", "Client"}, {"status", "Status"}, {"delivery_date", "Delivery Date"}}, `
			SELECT project_name, client_name, status::text AS status, delivery_date
			FROM projects
			WHERE delivery_date >= CURRENT_DATE
			  AND delivery_date < CURRENT_DATE + INTERVAL '7 days'
			  AND status NOT IN ('completed', 'archived')
			ORDER BY delivery_date ASC
			LIMIT 50
		`, "No projects are due this week."))
	case strings.Contains(normalized, "completed projects"):
		return handledResponse(s.answerStandardQuery(ctx, "Completed Projects", "These projects are marked completed.", []resultColumn{{"project_name", "Project"}, {"client_name", "Client"}, {"completed_at", "Completed At"}}, `
			SELECT project_name, client_name, completed_at
			FROM projects
			WHERE status = 'completed'
			ORDER BY COALESCE(completed_at, updated_at) DESC
			LIMIT 50
		`, "No completed projects found."))
	case strings.Contains(normalized, "highest number of issues") || strings.Contains(normalized, "highest issues"):
		return handledResponse(s.answerStandardQuery(ctx, "Project With Highest Issues", "This ranking is based on total issues linked to each project.", []resultColumn{{"project_name", "Project"}, {"client_name", "Client"}, {"issue_count", "Issues"}}, `
			SELECT p.project_name, p.client_name, COUNT(i.id) AS issue_count
			FROM projects p
			JOIN issues i ON i.project_id = p.id
			GROUP BY p.id, p.project_name, p.client_name
			ORDER BY issue_count DESC, p.project_name
			LIMIT 10
		`, "No project issues found."))
	case strings.Contains(normalized, "revision history"):
		projectName := cleanEntityName(strings.TrimSpace(regexp.MustCompile(`(?i).*revision history (?:for|of)?`).ReplaceAllString(message, "")))
		response, err := s.answerProjectRevisionHistory(ctx, projectName)
		return response, true, err
	case strings.Contains(normalized, "pending tasks"):
		return handledResponse(s.answerStandardQuery(ctx, "Pending Tasks", "These tasks are still pending.", []resultColumn{{"project_name", "Project"}, {"task", "Task"}, {"department", "Department"}, {"due_date", "Due Date"}}, `
			SELECT p.project_name,
			       COALESCE(t.title, 'Department task') AS task,
			       COALESCE(d.name, '-') AS department,
			       t.due_date
			FROM department_tasks t
			JOIN projects p ON p.id = t.project_id
			LEFT JOIN departments d ON d.id = t.department_id
			WHERE t.status = 'pending'
			ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
			LIMIT 50
		`, "No pending tasks found."))
	case strings.Contains(normalized, "tasks") && (strings.Contains(normalized, "blocked") || strings.Contains(normalized, "hold")):
		return handledResponse(s.answerStandardQuery(ctx, "Blocked Tasks", "The system represents blocked work using hold statuses.", []resultColumn{{"project_name", "Project"}, {"task", "Task"}, {"department", "Department"}, {"status", "Status"}}, `
			SELECT p.project_name,
			       COALESCE(t.title, 'Department task') AS task,
			       COALESCE(d.name, '-') AS department,
			       t.status::text AS status
			FROM department_tasks t
			JOIN projects p ON p.id = t.project_id
			LEFT JOIN departments d ON d.id = t.department_id
			WHERE t.status IN ('hold', 'issue_hold', 'on_hold')
			ORDER BY t.updated_at DESC
			LIMIT 50
		`, "No blocked tasks found."))
	case strings.Contains(normalized, "overdue tasks"):
		return handledResponse(s.answerStandardQuery(ctx, "Overdue Tasks", "These tasks are past due and not completed.", []resultColumn{{"project_name", "Project"}, {"task", "Task"}, {"department", "Department"}, {"status", "Status"}, {"due_date", "Due Date"}}, `
			SELECT p.project_name,
			       COALESCE(t.title, 'Department task') AS task,
			       COALESCE(d.name, '-') AS department,
			       t.status::text AS status,
			       t.due_date
			FROM department_tasks t
			JOIN projects p ON p.id = t.project_id
			LEFT JOIN departments d ON d.id = t.department_id
			WHERE t.due_date < CURRENT_DATE AND t.status <> 'completed'
			ORDER BY t.due_date ASC
			LIMIT 50
		`, "No overdue tasks found."))
	case strings.Contains(normalized, "who owns task"):
		taskRef := extractByRegex(message, `(?i)task\s+([a-z0-9-]+)`)
		response, err := s.answerTaskOwner(ctx, taskRef)
		return response, true, err
	case strings.Contains(normalized, "today") && (strings.Contains(normalized, "work updates") || strings.Contains(normalized, "production")):
		return handledResponse(s.answerTodayProduction(ctx))
	case strings.Contains(normalized, "departments submitted reports today"):
		return handledResponse(s.answerStandardQuery(ctx, "Departments That Submitted Reports Today", "These departments have at least one report for today.", []resultColumn{{"department", "Department"}, {"report_count", "Reports"}}, `
			SELECT COALESCE(d.name, '-') AS department, COUNT(dr.id) AS report_count
			FROM daily_reports dr
			LEFT JOIN departments d ON d.id = dr.department_id
			WHERE dr.report_date = CURRENT_DATE
			GROUP BY d.name
			ORDER BY report_count DESC, department
		`, "No departments submitted reports today."))
	case strings.Contains(normalized, "active routing") || strings.Contains(normalized, "routing version") || strings.Contains(normalized, "routing timeline"):
		projectName := extractByRegex(message, `(?i)(?:for|of)\s+(.+)$`)
		response, err := s.answerRouting(ctx, projectName, strings.Contains(normalized, "timeline"))
		return response, true, err
	case strings.Contains(normalized, "materials") && strings.Contains(normalized, "running low"):
		return "### Materials Running Low\n\nI cannot answer this reliably yet because the current schema stores material requisitions, not inventory stock levels or reorder thresholds.", true, nil
	case strings.Contains(normalized, "stock for"):
		return "### Material Stock\n\nI cannot show live stock from the current schema because there is no stock/inventory table. I can show requested or approved material requisitions instead.", true, nil
	case strings.Contains(normalized, "recently consumed materials") || strings.Contains(normalized, "consumed materials"):
		return handledResponse(s.answerStandardQuery(ctx, "Recently Requested Materials", "The schema tracks material requisitions. These are the most recent approved or fulfilled material items.", []resultColumn{{"material_name", "Material"}, {"quantity", "Qty"}, {"unit", "Unit"}, {"project_name", "Project"}, {"status", "Status"}, {"created_at", "Requested At"}}, `
			SELECT mi.material_name, mi.quantity, mi.unit, p.project_name, mr.status::text AS status, mr.created_at
			FROM material_items mi
			JOIN material_requisitions mr ON mr.id = mi.requisition_id
			JOIN projects p ON p.id = mr.project_id
			WHERE mr.status IN ('approved', 'fulfilled')
			ORDER BY mr.created_at DESC
			LIMIT 50
		`, "No approved or fulfilled material requisitions found."))
	case strings.Contains(normalized, "unresolved issues"):
		return handledResponse(s.answerStandardQuery(ctx, "Unresolved Issues", "These issues are not resolved or closed.", []resultColumn{{"project_name", "Project"}, {"title", "Issue"}, {"department", "Department"}, {"status", "Status"}, {"created_at", "Raised At"}}, `
			SELECT p.project_name, i.title, COALESCE(d.name, '-') AS department, i.status::text AS status, i.created_at
			FROM issues i
			JOIN projects p ON p.id = i.project_id
			LEFT JOIN departments d ON d.id = i.department_id
			WHERE i.status NOT IN ('resolved', 'closed')
			ORDER BY i.created_at ASC
			LIMIT 50
		`, "No unresolved issues found."))
	case strings.Contains(normalized, "issue") && strings.Contains(normalized, "open the longest"):
		return handledResponse(s.answerStandardQuery(ctx, "Oldest Open Issue", "This is the unresolved issue that has been open the longest.", []resultColumn{{"project_name", "Project"}, {"title", "Issue"}, {"department", "Department"}, {"status", "Status"}, {"created_at", "Raised At"}}, `
			SELECT p.project_name, i.title, COALESCE(d.name, '-') AS department, i.status::text AS status, i.created_at
			FROM issues i
			JOIN projects p ON p.id = i.project_id
			LEFT JOIN departments d ON d.id = i.department_id
			WHERE i.status NOT IN ('resolved', 'closed')
			ORDER BY i.created_at ASC
			LIMIT 1
		`, "No open issues found."))
	case strings.Contains(normalized, "today") && strings.Contains(normalized, "reworks"):
		return handledResponse(s.answerStandardQuery(ctx, "Today's Reworks", "These rework requests were created today.", []resultColumn{{"project_name", "Project"}, {"reason", "Reason"}, {"requested_by", "Requested By"}, {"status", "Status"}, {"created_at", "Created At"}}, `
			SELECT p.project_name, rw.reason, COALESCE(CONCAT(e.first_name, ' ', e.last_name), '-') AS requested_by, rw.status::text AS status, rw.created_at
			FROM rework_requests rw
			JOIN projects p ON p.id = rw.project_id
			LEFT JOIN employees e ON e.id = rw.requested_by
			WHERE rw.created_at::date = CURRENT_DATE
			ORDER BY rw.created_at DESC
			LIMIT 50
		`, "No reworks were created today."))
	case strings.Contains(normalized, "highest rework count"):
		return handledResponse(s.answerStandardQuery(ctx, "Projects With Highest Rework Count", "This ranking is based on total rework requests.", []resultColumn{{"project_name", "Project"}, {"client_name", "Client"}, {"rework_count", "Reworks"}}, `
			SELECT p.project_name, p.client_name, COUNT(rw.id) AS rework_count
			FROM projects p
			JOIN rework_requests rw ON rw.project_id = p.id
			GROUP BY p.id, p.project_name, p.client_name
			ORDER BY rework_count DESC, p.project_name
			LIMIT 10
		`, "No reworks found."))
	case strings.Contains(normalized, "unread notifications"):
		return handledResponse(s.answerStandardQuery(ctx, "Unread Notifications", "These notifications are still unread.", []resultColumn{{"recipient", "Recipient"}, {"title", "Title"}, {"type", "Type"}, {"created_at", "Created At"}}, `
			SELECT COALESCE(CONCAT(e.first_name, ' ', e.last_name), '-') AS recipient,
			       n.title,
			       n.type::text AS type,
			       n.created_at
			FROM notifications n
			LEFT JOIN employees e ON e.id = n.recipient_id
			WHERE n.is_read = FALSE
			ORDER BY n.created_at DESC
			LIMIT 50
		`, "No unread notifications found."))
	case strings.Contains(normalized, "pending approvals"):
		return handledResponse(s.answerPendingApprovals(ctx))
	case strings.Contains(normalized, "highest workload"):
		return handledResponse(s.answerStandardQuery(ctx, "Department Workload", "Workload is counted from non-completed department tasks.", []resultColumn{{"department", "Department"}, {"open_tasks", "Open Tasks"}}, `
			SELECT COALESCE(d.name, '-') AS department, COUNT(t.id) AS open_tasks
			FROM departments d
			LEFT JOIN department_tasks t ON t.department_id = d.id AND t.status <> 'completed'
			WHERE d.is_active = TRUE
			GROUP BY d.name
			ORDER BY open_tasks DESC, department
			LIMIT 10
		`, "No department workload found."))
	case strings.Contains(normalized, "completed the most tasks today"):
		return handledResponse(s.answerStandardQuery(ctx, "Departments Completing Most Tasks Today", "This counts tasks completed today by department.", []resultColumn{{"department", "Department"}, {"completed_tasks", "Completed Tasks"}}, `
			SELECT COALESCE(d.name, '-') AS department, COUNT(t.id) AS completed_tasks
			FROM department_tasks t
			LEFT JOIN departments d ON d.id = t.department_id
			WHERE t.status = 'completed' AND t.completed_at::date = CURRENT_DATE
			GROUP BY d.name
			ORDER BY completed_tasks DESC, department
			LIMIT 10
		`, "No tasks were completed today."))
	case strings.Contains(normalized, "what happened today") || strings.Contains(normalized, "production summary") || strings.Contains(normalized, "week activities"):
		return handledResponse(s.answerActivitySummary(ctx, strings.Contains(normalized, "week")))
	}

	return "", false, nil
}

func (s *AIService) answerStandardQuery(ctx context.Context, title, intro string, columns []resultColumn, sql string, emptyMessage string) (string, error) {
	results, err := s.ExecuteQuery(ctx, sql)
	if err != nil {
		return "", err
	}
	if len(results) == 0 {
		return fmt.Sprintf("### %s\n\n%s", title, emptyMessage), nil
	}

	var response strings.Builder
	response.WriteString(fmt.Sprintf("### %s\n\n%s\n\n", title, intro))
	response.WriteString(markdownTable(results, columns, 25))
	if len(results) > 25 {
		response.WriteString(fmt.Sprintf("\n\nShowing first 25 of %d records.", len(results)))
	}
	return response.String(), nil
}

func (s *AIService) answerEmployeeCurrentWork(ctx context.Context, name string) (string, error) {
	employee, matches, err := s.resolveEmployee(ctx, name)
	if err != nil {
		return "", err
	}
	if employee == nil {
		return fmt.Sprintf("### Employee Not Found\n\nI could not find an active employee matching **%s**.", name), nil
	}
	if len(matches) > 1 && matches[0].Score < 0.45 && nearScore(matches[0].Score, matches[1].Score) {
		return ambiguousEmployeeResponse(name, matches), nil
	}

	results, err := s.ExecuteQueryWithArgs(ctx, `
		SELECT p.project_name,
		       COALESCE(t.title, 'Department task') AS task,
		       COALESCE(d.name, '-') AS department,
		       t.status::text AS status,
		       t.due_date,
		       t.started_at,
		       tea.assigned_at
		FROM task_employee_assignments tea
		JOIN department_tasks t ON t.id = tea.task_id
		JOIN projects p ON p.id = t.project_id
		LEFT JOIN departments d ON d.id = t.department_id
		WHERE tea.employee_id = $1
		  AND t.status IN ('in_progress', 'pending', 'hold', 'issue_hold', 'on_hold')
		ORDER BY
		  CASE t.status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
		  COALESCE(t.started_at, tea.assigned_at, t.updated_at) DESC
		LIMIT 10
	`, employee.ID)
	if err != nil {
		return "", err
	}

	var response strings.Builder
	response.WriteString(fmt.Sprintf("### %s's Current Work\n\n", employee.Name))
	if !strings.EqualFold(cleanEntityName(name), employee.Name) {
		response.WriteString(fmt.Sprintf("Matched **%s** to **%s**.\n\n", name, employee.Name))
	}
	if len(results) == 0 {
		response.WriteString("I did not find any active assigned task for this employee right now.")
		return response.String(), nil
	}

	response.WriteString("Here is the active work I found:\n\n")
	response.WriteString(markdownTable(results, []resultColumn{
		{"project_name", "Project"},
		{"task", "Task"},
		{"department", "Department"},
		{"status", "Status"},
		{"due_date", "Due Date"},
	}, 10))
	return response.String(), nil
}

func (s *AIService) answerEmployeeLastWork(ctx context.Context, name string) (string, error) {
	employee, matches, err := s.resolveEmployee(ctx, name)
	if err != nil {
		return "", err
	}
	if employee == nil {
		return fmt.Sprintf("### Employee Not Found\n\nI could not find an active employee matching **%s**.", name), nil
	}
	if len(matches) > 1 && matches[0].Score < 0.45 && nearScore(matches[0].Score, matches[1].Score) {
		return ambiguousEmployeeResponse(name, matches), nil
	}

	reports, err := s.ExecuteQueryWithArgs(ctx, `
		SELECT dr.report_date,
		       p.project_name,
		       COALESCE(d.name, '-') AS department,
		       COALESCE(t.title, '-') AS task,
		       dr.description,
		       dr.created_at
		FROM daily_reports dr
		JOIN projects p ON p.id = dr.project_id
		LEFT JOIN departments d ON d.id = dr.department_id
		LEFT JOIN department_tasks t ON t.id = dr.task_id
		WHERE dr.submitted_by = $1
		ORDER BY dr.report_date DESC, dr.created_at DESC
		LIMIT 5
	`, employee.ID)
	if err != nil {
		return "", err
	}

	tasks, err := s.ExecuteQueryWithArgs(ctx, `
		SELECT p.project_name,
		       COALESCE(t.title, 'Department task') AS task,
		       COALESCE(d.name, '-') AS department,
		       t.status::text AS status,
		       t.completed_at,
		       t.updated_at
		FROM task_employee_assignments tea
		JOIN department_tasks t ON t.id = tea.task_id
		JOIN projects p ON p.id = t.project_id
		LEFT JOIN departments d ON d.id = t.department_id
		WHERE tea.employee_id = $1
		ORDER BY COALESCE(t.completed_at, t.updated_at, tea.assigned_at) DESC
		LIMIT 5
	`, employee.ID)
	if err != nil {
		return "", err
	}

	var response strings.Builder
	response.WriteString(fmt.Sprintf("### %s's Last Work\n\n", employee.Name))
	if !strings.EqualFold(cleanEntityName(name), employee.Name) {
		response.WriteString(fmt.Sprintf("Matched **%s** to **%s**.\n\n", name, employee.Name))
	}

	if len(reports) > 0 {
		response.WriteString("**Latest daily reports**\n\n")
		response.WriteString(markdownTable(reports, []resultColumn{
			{"report_date", "Date"},
			{"project_name", "Project"},
			{"department", "Department"},
			{"task", "Task"},
			{"description", "Update"},
		}, 5))
	}

	if len(tasks) > 0 {
		if len(reports) > 0 {
			response.WriteString("\n\n")
		}
		response.WriteString("**Latest assigned tasks**\n\n")
		response.WriteString(markdownTable(tasks, []resultColumn{
			{"project_name", "Project"},
			{"task", "Task"},
			{"department", "Department"},
			{"status", "Status"},
			{"completed_at", "Completed At"},
		}, 5))
	}

	if len(reports) == 0 && len(tasks) == 0 {
		response.WriteString("I found the employee, but there are no reports or assigned tasks recorded yet.")
	}

	return response.String(), nil
}

func (s *AIService) answerProjectRevisionHistory(ctx context.Context, projectName string) (string, error) {
	project, matches, err := s.resolveProject(ctx, projectName)
	if err != nil {
		return "", err
	}
	if project == nil {
		return fmt.Sprintf("### Project Not Found\n\nI could not find a project matching **%s**.", projectName), nil
	}
	if len(matches) > 1 && matches[0].Score < 0.45 && nearScore(matches[0].Score, matches[1].Score) {
		return ambiguousProjectResponse(projectName, matches), nil
	}

	return s.answerStandardQuery(ctx, "Revision History", fmt.Sprintf("Revision history for **%s**.", project.Name), []resultColumn{
		{"revision_number", "Revision"},
		{"revised_by", "Revised By"},
		{"reason", "Reason"},
		{"client_request", "Client Request"},
		{"routing_changed", "Routing Changed"},
		{"created_at", "Created At"},
	}, `
		SELECT pr.revision_number,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '-') AS revised_by,
		       pr.reason,
		       COALESCE(pr.client_request, '-') AS client_request,
		       pr.routing_changed,
		       pr.created_at
		FROM project_revisions pr
		LEFT JOIN employees e ON e.id = pr.revised_by
		WHERE pr.project_id = '`+strings.ReplaceAll(project.ID, "'", "''")+`'
		ORDER BY pr.revision_number DESC
	`, "No revisions found for this project.")
}

func (s *AIService) answerTaskOwner(ctx context.Context, taskRef string) (string, error) {
	taskRef = strings.TrimSpace(taskRef)
	if taskRef == "" {
		return "### Task Owner\n\nPlease mention the task ID or task title so I can find the owner.", nil
	}

	results, err := s.ExecuteQueryWithArgs(ctx, `
		SELECT p.project_name,
		       COALESCE(t.title, 'Department task') AS task,
		       COALESCE(d.name, '-') AS department,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '-') AS owner,
		       t.status::text AS status
		FROM department_tasks t
		JOIN projects p ON p.id = t.project_id
		LEFT JOIN departments d ON d.id = t.department_id
		LEFT JOIN task_employee_assignments tea ON tea.task_id = t.id
		LEFT JOIN employees e ON e.id = tea.employee_id
		WHERE t.id::text ILIKE $1 OR COALESCE(t.title, '') ILIKE $2
		ORDER BY t.updated_at DESC
		LIMIT 20
	`, taskRef+"%", "%"+taskRef+"%")
	if err != nil {
		return "", err
	}

	if len(results) == 0 {
		return fmt.Sprintf("### Task Owner\n\nI could not find a task matching **%s**.", taskRef), nil
	}

	var response strings.Builder
	response.WriteString("### Task Owner\n\n")
	response.WriteString(markdownTable(results, []resultColumn{
		{"project_name", "Project"},
		{"task", "Task"},
		{"department", "Department"},
		{"owner", "Owner"},
		{"status", "Status"},
	}, 20))
	return response.String(), nil
}

func (s *AIService) answerTodayProduction(ctx context.Context) (string, error) {
	results, err := s.ExecuteQuery(ctx, `
		SELECT dr.report_date,
		       p.project_name,
		       COALESCE(d.name, '-') AS department,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '-') AS submitted_by,
		       dr.description
		FROM daily_reports dr
		JOIN projects p ON p.id = dr.project_id
		LEFT JOIN departments d ON d.id = dr.department_id
		LEFT JOIN employees e ON e.id = dr.submitted_by
		WHERE dr.report_date = CURRENT_DATE
		ORDER BY dr.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		return "", err
	}
	if len(results) == 0 {
		return "### Today's Work Updates\n\nNo daily reports have been submitted today.", nil
	}

	var response strings.Builder
	response.WriteString(fmt.Sprintf("### Today's Work Updates\n\n%d report(s) submitted today.\n\n", len(results)))
	response.WriteString(markdownTable(results, []resultColumn{
		{"project_name", "Project"},
		{"department", "Department"},
		{"submitted_by", "Submitted By"},
		{"description", "Update"},
	}, 25))
	if len(results) > 25 {
		response.WriteString(fmt.Sprintf("\n\nShowing first 25 of %d reports.", len(results)))
	}
	return response.String(), nil
}

func (s *AIService) answerRouting(ctx context.Context, projectName string, timeline bool) (string, error) {
	projectName = cleanEntityName(projectName)
	if projectName == "" {
		return "### Routing\n\nPlease mention the project name so I can check its routing.", nil
	}

	project, matches, err := s.resolveProject(ctx, projectName)
	if err != nil {
		return "", err
	}
	if project == nil {
		return fmt.Sprintf("### Routing\n\nI could not find a project matching **%s**.", projectName), nil
	}
	if len(matches) > 1 && matches[0].Score < 0.45 && nearScore(matches[0].Score, matches[1].Score) {
		return ambiguousProjectResponse(projectName, matches), nil
	}

	if timeline {
		return s.answerStandardQuery(ctx, "Routing Timeline", fmt.Sprintf("Routing timeline for **%s**.", project.Name), []resultColumn{
			{"version", "Version"},
			{"name", "Name"},
			{"status", "Status"},
			{"routing_type", "Type"},
			{"published_at", "Published At"},
			{"created_at", "Created At"},
		}, `
			SELECT version,
			       COALESCE(name, '-') AS name,
			       status::text AS status,
			       routing_type,
			       published_at,
			       created_at
			FROM routings
			WHERE project_id = '`+strings.ReplaceAll(project.ID, "'", "''")+`'
			ORDER BY version DESC
		`, "No routing records found for this project.")
	}

	return s.answerStandardQuery(ctx, "Active Routing", fmt.Sprintf("Active routing for **%s**.", project.Name), []resultColumn{
		{"version", "Version"},
		{"name", "Name"},
		{"status", "Status"},
		{"routing_type", "Type"},
		{"published_at", "Published At"},
	}, `
		SELECT version,
		       COALESCE(name, '-') AS name,
		       status::text AS status,
		       routing_type,
		       published_at
		FROM routings
		WHERE project_id = '`+strings.ReplaceAll(project.ID, "'", "''")+`'
		  AND status = 'active'
		ORDER BY version DESC
		LIMIT 1
	`, "No active routing found for this project.")
}

func (s *AIService) answerPendingApprovals(ctx context.Context) (string, error) {
	results, err := s.ExecuteQuery(ctx, `
		SELECT 'Issue' AS item_type, p.project_name, i.title AS item, i.status::text AS status, i.created_at
		FROM issues i
		JOIN projects p ON p.id = i.project_id
		WHERE i.status = 'pending_approval'
		UNION ALL
		SELECT 'Rework' AS item_type, p.project_name, rw.reason AS item, rw.status::text AS status, rw.created_at
		FROM rework_requests rw
		JOIN projects p ON p.id = rw.project_id
		WHERE rw.status = 'pending'
		UNION ALL
		SELECT 'Material' AS item_type, p.project_name, mr.title AS item, mr.status::text AS status, mr.created_at
		FROM material_requisitions mr
		JOIN projects p ON p.id = mr.project_id
		WHERE mr.status = 'pending'
		ORDER BY created_at DESC
		LIMIT 50
	`)
	if err != nil {
		return "", err
	}
	if len(results) == 0 {
		return "### Pending Approvals\n\nNo pending approvals found.", nil
	}

	var response strings.Builder
	response.WriteString("### Pending Approvals\n\n")
	response.WriteString(markdownTable(results, []resultColumn{
		{"item_type", "Type"},
		{"project_name", "Project"},
		{"item", "Item"},
		{"status", "Status"},
		{"created_at", "Created At"},
	}, 50))
	return response.String(), nil
}

func (s *AIService) answerActivitySummary(ctx context.Context, week bool) (string, error) {
	dateFilter := "created_at::date = CURRENT_DATE"
	reportFilter := "report_date = CURRENT_DATE"
	taskFilter := "completed_at::date = CURRENT_DATE"
	title := "Today"
	if week {
		dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'"
		reportFilter = "report_date >= CURRENT_DATE - INTERVAL '7 days'"
		taskFilter = "completed_at >= CURRENT_DATE - INTERVAL '7 days'"
		title = "This Week"
	}

	counts, err := s.ExecuteQuery(ctx, fmt.Sprintf(`
		SELECT
		  (SELECT COUNT(*) FROM daily_reports WHERE %s) AS reports,
		  (SELECT COUNT(*) FROM department_tasks WHERE status = 'completed' AND %s) AS completed_tasks,
		  (SELECT COUNT(*) FROM issues WHERE %s) AS issues_raised,
		  (SELECT COUNT(*) FROM rework_requests WHERE %s) AS reworks,
		  (SELECT COUNT(*) FROM material_requisitions WHERE %s) AS material_requests
	`, reportFilter, taskFilter, dateFilter, dateFilter, dateFilter))
	if err != nil {
		return "", err
	}

	recent, err := s.ExecuteQuery(ctx, fmt.Sprintf(`
		SELECT p.project_name,
		       COALESCE(d.name, '-') AS department,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '-') AS submitted_by,
		       dr.description,
		       dr.report_date
		FROM daily_reports dr
		JOIN projects p ON p.id = dr.project_id
		LEFT JOIN departments d ON d.id = dr.department_id
		LEFT JOIN employees e ON e.id = dr.submitted_by
		WHERE %s
		ORDER BY dr.report_date DESC, dr.created_at DESC
		LIMIT 10
	`, reportFilter))
	if err != nil {
		return "", err
	}

	var response strings.Builder
	response.WriteString(fmt.Sprintf("### %s's Production Summary\n\n", title))
	if len(counts) > 0 {
		response.WriteString(markdownTable(counts, []resultColumn{
			{"reports", "Reports"},
			{"completed_tasks", "Completed Tasks"},
			{"issues_raised", "Issues Raised"},
			{"reworks", "Reworks"},
			{"material_requests", "Material Requests"},
		}, 1))
	}
	if len(recent) > 0 {
		response.WriteString("\n\n**Latest updates**\n\n")
		response.WriteString(markdownTable(recent, []resultColumn{
			{"report_date", "Date"},
			{"project_name", "Project"},
			{"department", "Department"},
			{"submitted_by", "Submitted By"},
			{"description", "Update"},
		}, 10))
	}
	return response.String(), nil
}

func (s *AIService) resolveEmployee(ctx context.Context, name string) (*entityMatch, []entityMatch, error) {
	name = cleanEntityName(name)
	if name == "" {
		return nil, nil, nil
	}

	results, err := s.ExecuteQueryWithArgs(ctx, `
		SELECT id::text AS id,
		       CONCAT(first_name, ' ', last_name) AS name,
		       email AS descriptor,
		       GREATEST(
		         similarity(lower(CONCAT(first_name, ' ', last_name)), lower($1)),
		         similarity(lower(first_name), lower($1)),
		         similarity(lower(last_name), lower($1))
		       ) AS score
		FROM employees
		WHERE is_active = TRUE
		  AND (
		    lower(CONCAT(first_name, ' ', last_name)) ILIKE lower($2)
		    OR lower(first_name) ILIKE lower($2)
		    OR lower(last_name) ILIKE lower($2)
		    OR similarity(lower(CONCAT(first_name, ' ', last_name)), lower($1)) > 0.1
		    OR similarity(lower(first_name), lower($1)) > 0.1
		  )
		ORDER BY score DESC, name
		LIMIT 5
	`, name, "%"+name+"%")
	if err != nil {
		return nil, nil, err
	}

	matches := rowsToMatches(results)
	if len(matches) == 0 {
		return nil, nil, nil
	}
	return &matches[0], matches, nil
}

func (s *AIService) resolveProject(ctx context.Context, name string) (*entityMatch, []entityMatch, error) {
	name = cleanEntityName(name)
	if name == "" {
		return nil, nil, nil
	}

	results, err := s.ExecuteQueryWithArgs(ctx, `
		SELECT id::text AS id,
		       project_name AS name,
		       client_name AS descriptor,
		       GREATEST(
		         similarity(lower(project_name), lower($1)),
		         similarity(lower(po_number), lower($1)),
		         similarity(lower(client_name), lower($1))
		       ) AS score
		FROM projects
		WHERE lower(project_name) ILIKE lower($2)
		   OR lower(po_number) ILIKE lower($2)
		   OR lower(client_name) ILIKE lower($2)
		   OR similarity(lower(project_name), lower($1)) > 0.1
		ORDER BY score DESC, updated_at DESC
		LIMIT 5
	`, name, "%"+name+"%")
	if err != nil {
		return nil, nil, err
	}

	matches := rowsToMatches(results)
	if len(matches) == 0 {
		return nil, nil, nil
	}
	return &matches[0], matches, nil
}

func rowsToMatches(rows []map[string]interface{}) []entityMatch {
	matches := make([]entityMatch, 0, len(rows))
	for _, row := range rows {
		match := entityMatch{
			ID:         fmt.Sprintf("%v", row["id"]),
			Name:       fmt.Sprintf("%v", row["name"]),
			Descriptor: fmt.Sprintf("%v", row["descriptor"]),
			Score:      numberValue(row["score"]),
		}
		matches = append(matches, match)
	}
	return matches
}

func nearScore(a, b float64) bool {
	diff := a - b
	if diff < 0 {
		diff = -diff
	}
	return diff < 0.08
}

func ambiguousEmployeeResponse(input string, matches []entityMatch) string {
	return ambiguousEntityResponse("Employee", input, matches)
}

func ambiguousProjectResponse(input string, matches []entityMatch) string {
	return ambiguousEntityResponse("Project", input, matches)
}

func ambiguousEntityResponse(kind, input string, matches []entityMatch) string {
	var response strings.Builder
	response.WriteString(fmt.Sprintf("### %s Match Needed\n\nI found multiple possible matches for **%s**. Please specify one:\n\n", kind, input))
	limit := len(matches)
	if limit > 3 {
		limit = 3
	}
	for i := 0; i < limit; i++ {
		descriptor := matches[i].Descriptor
		if descriptor != "" && descriptor != "<nil>" {
			response.WriteString(fmt.Sprintf("- **%s** (%s)\n", matches[i].Name, descriptor))
		} else {
			response.WriteString(fmt.Sprintf("- **%s**\n", matches[i].Name))
		}
	}
	return response.String()
}

func markdownTable(rows []map[string]interface{}, columns []resultColumn, limit int) string {
	if len(rows) == 0 {
		return ""
	}
	if limit <= 0 || limit > len(rows) {
		limit = len(rows)
	}

	var response strings.Builder
	for _, col := range columns {
		response.WriteString("| ")
		response.WriteString(col.Label)
		response.WriteString(" ")
	}
	response.WriteString("|\n")
	for range columns {
		response.WriteString("|---")
	}
	response.WriteString("|\n")

	for i := 0; i < limit; i++ {
		for _, col := range columns {
			response.WriteString("| ")
			response.WriteString(formatMarkdownValue(rows[i][col.Key]))
			response.WriteString(" ")
		}
		response.WriteString("|\n")
	}

	return strings.TrimRight(response.String(), "\n")
}

func formatMarkdownValue(value interface{}) string {
	if value == nil {
		return "-"
	}

	var output string
	switch v := value.(type) {
	case time.Time:
		if v.Hour() == 0 && v.Minute() == 0 && v.Second() == 0 {
			output = v.Format("2006-01-02")
		} else {
			output = v.Format("2006-01-02 15:04")
		}
	default:
		output = fmt.Sprintf("%v", value)
	}

	output = strings.TrimSpace(output)
	if output == "" || output == "<nil>" {
		return "-"
	}
	output = strings.ReplaceAll(output, "_", " ")
	output = strings.ReplaceAll(output, "\n", " ")
	output = strings.ReplaceAll(output, "|", "\\|")
	if len(output) > 180 {
		output = output[:177] + "..."
	}
	return output
}

func numberValue(value interface{}) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int64:
		return float64(v)
	case int:
		return float64(v)
	case []byte:
		var parsed float64
		fmt.Sscanf(string(v), "%f", &parsed)
		return parsed
	case string:
		var parsed float64
		fmt.Sscanf(v, "%f", &parsed)
		return parsed
	default:
		return 0
	}
}

// ProcessChat handles the complete chat flow
func (s *AIService) ProcessChat(ctx context.Context, message string) (string, error) {
	message = strings.TrimSpace(message)
	log.Printf("AI Service: Processing chat message: %s", message)

	switch classifyChatIntent(message) {
	case intentGreeting:
		return "Hi. I’m ready to help with employees, projects, tasks, reports, issues, routing, materials, notifications, and production summaries.", nil
	case intentHelp:
		return "Ask me things like **What is Amit working on right now?**, **Which projects are delayed?**, **Who has not submitted today's report?**, or **Give me a production summary**.", nil
	case intentSmallTalk:
		return "I’m here. Ask me about your production data and I’ll check the system step by step.", nil
	}

	if response, handled, err := s.processBusinessQuery(ctx, message); handled {
		return response, err
	}

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
	schemaJSON, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal schema: %w", err)
	}

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

If the question can be answered in 1 step, just provide Step 1 and Query 1.`, string(schemaJSON), message)

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

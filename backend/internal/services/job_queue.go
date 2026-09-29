package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/config"
	"github.com/redis/go-redis/v9"
)

// Job represents a background job
type Job struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt time.Time              `json:"created_at"`
	ScheduledAt time.Time            `json:"scheduled_at,omitempty"`
	MaxRetries int                   `json:"max_retries"`
	Retries   int                    `json:"retries"`
}

// JobHandler defines the function signature for job handlers
type JobHandler func(ctx context.Context, job *Job) error

// JobQueue manages background jobs using Redis
type JobQueue struct {
	client        *redis.Client
	queueKey      string
	processingKey string
	handlers      map[string]JobHandler
	workerCount   int
}

// NewJobQueue creates a new job queue
func NewJobQueue(queueName string, workerCount int) *JobQueue {
	return &JobQueue{
		client:        config.RedisClient,
		queueKey:      fmt.Sprintf("queue:%s", queueName),
		processingKey: fmt.Sprintf("queue:%s:processing", queueName),
		handlers:      make(map[string]JobHandler),
		workerCount:   workerCount,
	}
}

// RegisterHandler registers a job handler for a specific job type
func (q *JobQueue) RegisterHandler(jobType string, handler JobHandler) {
	q.handlers[jobType] = handler
}

// Enqueue adds a job to the queue
func (q *JobQueue) Enqueue(ctx context.Context, jobType string, payload map[string]interface{}, delay time.Duration) error {
	if q.client == nil || !config.IsRedisAvailable() {
		return fmt.Errorf("Redis not available")
	}

	job := &Job{
		ID:        uuid.New().String(),
		Type:      jobType,
		Payload:   payload,
		CreatedAt: time.Now(),
		MaxRetries: 3,
		Retries:   0,
	}

	if delay > 0 {
		job.ScheduledAt = time.Now().Add(delay)
	}

	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	// If scheduled for later, use sorted set; otherwise use list
	if delay > 0 {
		score := float64(job.ScheduledAt.Unix())
		return q.client.ZAdd(ctx, q.queueKey+":scheduled", redis.Z{Score: score, Member: data}).Err()
	}

	return q.client.LPush(ctx, q.queueKey, data).Err()
}

// StartWorkers starts the worker pool
func (q *JobQueue) StartWorkers(ctx context.Context) {
	if q.client == nil || !config.IsRedisAvailable() {
		log.Println("Redis not available, job queue workers not started")
		return
	}

	log.Printf("Starting %d job queue workers for %s", q.workerCount, q.queueKey)

	for i := 0; i < q.workerCount; i++ {
		go q.worker(ctx, i)
	}

	// Start scheduled job processor
	go q.scheduledJobProcessor(ctx)
}

// worker processes jobs from the queue
func (q *JobQueue) worker(ctx context.Context, workerID int) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			q.processNextJob(ctx, workerID)
		}
	}
}

// processNextJob processes the next available job
func (q *JobQueue) processNextJob(ctx context.Context, workerID int) {
	// Use BRPOPLPUSH to atomically move job from queue to processing
	result, err := q.client.BRPopLPush(ctx, q.queueKey, q.processingKey, 5*time.Second).Result()
	if err != nil {
		if err != redis.Nil {
			log.Printf("Worker %d: Error fetching job: %v", workerID, err)
		}
		return
	}

	var job Job
	if err := json.Unmarshal([]byte(result), &job); err != nil {
		log.Printf("Worker %d: Failed to unmarshal job: %v", workerID, err)
		q.client.LRem(ctx, q.processingKey, 1, result)
		return
	}

	log.Printf("Worker %d: Processing job %s (type: %s)", workerID, job.ID, job.Type)

	// Execute job handler
	handler, exists := q.handlers[job.Type]
	if !exists {
		log.Printf("Worker %d: No handler for job type %s", workerID, job.Type)
		q.client.LRem(ctx, q.processingKey, 1, result)
		return
	}

	if err := handler(ctx, &job); err != nil {
		log.Printf("Worker %d: Job %s failed: %v", workerID, job.ID, err)

		// Retry logic
		if job.Retries < job.MaxRetries {
			job.Retries++
			data, _ := json.Marshal(job)
			q.client.LRem(ctx, q.processingKey, 1, result)
			q.client.LPush(ctx, q.queueKey, data)
			return
		}

		// Max retries reached, log and remove
		log.Printf("Worker %d: Job %s failed after %d retries", workerID, job.ID, job.MaxRetries)
	}

	// Remove from processing queue
	q.client.LRem(ctx, q.processingKey, 1, result)
	log.Printf("Worker %d: Job %s completed successfully", workerID, job.ID)
}

// scheduledJobProcessor moves scheduled jobs to the main queue when their time comes
func (q *JobQueue) scheduledJobProcessor(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			q.processScheduledJobs(ctx)
		}
	}
}

// processScheduledJobs moves jobs whose scheduled time has arrived to the main queue
func (q *JobQueue) processScheduledJobs(ctx context.Context) {
	now := float64(time.Now().Unix())

	// Get all jobs scheduled before now
	results, err := q.client.ZRangeByScore(ctx, q.queueKey+":scheduled", &redis.ZRangeBy{
		Min: "0",
		Max: fmt.Sprintf("%f", now),
	}).Result()

	if err != nil {
		log.Printf("Error fetching scheduled jobs: %v", err)
		return
	}

	for _, result := range results {
		// Move to main queue
		q.client.LPush(ctx, q.queueKey, result)
		// Remove from scheduled set
		q.client.ZRem(ctx, q.queueKey+":scheduled", result)
	}
}

// QueueLength returns the current queue length
func (q *JobQueue) QueueLength(ctx context.Context) (int64, error) {
	if q.client == nil || !config.IsRedisAvailable() {
		return 0, fmt.Errorf("Redis not available")
	}

	return q.client.LLen(ctx, q.queueKey).Result()
}

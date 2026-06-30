package files

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"pms/backend/pkg/response"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// Handler provides S3 file upload endpoints.
type Handler struct{ s3 *S3Client }

func NewHandler(s3 *S3Client) *Handler { return &Handler{s3: s3} }

var allowedMIME = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"application/pdf": true,
}

const maxImageSize = 10 << 20 // 10MB
const maxPDFSize = 25 << 20   // 25MB

// Upload handles POST /files/upload (multipart/form-data).
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxPDFSize); err != nil {
		response.Error(w, http.StatusBadRequest, "PARSE_ERROR", "failed to parse form", "")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "NO_FILE", "no file provided", "file")
		return
	}
	defer file.Close()

	// Detect MIME from first 512 bytes
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	mime := http.DetectContentType(buf[:n])
	if _, err := file.Seek(0, 0); err != nil {
		response.Error(w, http.StatusInternalServerError, "FILE_ERROR", "failed to read upload", "")
		return
	}

	if !allowedMIME[mime] {
		response.Error(w, http.StatusUnsupportedMediaType, "INVALID_MIME",
			"only JPEG, PNG, WebP, and PDF are allowed", "file")
		return
	}

	maxSize := int64(maxImageSize)
	if mime == "application/pdf" {
		maxSize = maxPDFSize
	}
	if header.Size > maxSize {
		response.Error(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE",
			fmt.Sprintf("file exceeds maximum size of %dMB", maxSize>>20), "file")
		return
	}

	// Build S3 key
	folder := r.FormValue("folder") // e.g. "projects/uuid/cover"
	ext := filepath.Ext(header.Filename)
	key := fmt.Sprintf("%s/%s%s", strings.TrimSuffix(folder, "/"), uuid.NewString(), ext)

	// Upload directly to S3
	ctx := r.Context()
	_, uploadErr := h.s3.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:               aws.String(h.s3.bucket),
		Key:                  aws.String(key),
		Body:                 file,
		ContentType:          aws.String(mime),
		ServerSideEncryption: "AES256",
	})
	if uploadErr != nil {
		response.Error(w, http.StatusInternalServerError, "S3_ERROR", "upload failed", "")
		return
	}

	readURL, expiresAt, err := h.s3.PresignedReadURL(ctx, key, 15*time.Minute)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "S3_ERROR", "failed to create preview URL", "")
		return
	}
	response.JSON(w, http.StatusCreated, map[string]string{
		"key":        key,
		"url":        readURL,
		"public_url": h.s3.PublicURL(key),
		"expires_at": expiresAt.Format(time.RFC3339),
	})
}

// Presigned handles GET /files/presigned?key=...
func (h *Handler) Presigned(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		response.Error(w, http.StatusBadRequest, "MISSING_KEY", "key query parameter is required", "key")
		return
	}
	stored := key
	extracted := h.s3.extractKeyFromStored(stored)
	if extracted != "" {
		key = extracted
	}
	readURL, expiresAt, err := h.s3.PresignedReadURL(r.Context(), key, 15*time.Minute)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "S3_ERROR", "failed to create preview URL", "")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"url":        readURL,
		"expires_at": expiresAt.Format(time.RFC3339),
	})
}

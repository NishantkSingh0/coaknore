package services

import (
	"context"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	appconfig "github.com/pms/backend/internal/config"
	"github.com/pms/backend/internal/models"
	"database/sql"
)

type FileService struct {
	db       *sql.DB
	s3Client *s3.Client
	bucket   string
}

func NewFileService(db *sql.DB) (*FileService, error) {
	cfg := appconfig.App

	var awsCfg aws.Config
	var err error

	if cfg.AWSAccessKeyID != "" && cfg.AWSSecretAccessKey != "" {
		awsCfg, err = config.LoadDefaultConfig(context.Background(),
			config.WithRegion(cfg.AWSRegion),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AWSAccessKeyID,
				cfg.AWSSecretAccessKey,
				"",
			)),
		)
	} else {
		// Use instance role / environment credentials
		awsCfg, err = config.LoadDefaultConfig(context.Background(),
			config.WithRegion(cfg.AWSRegion),
		)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to configure AWS: %w", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.AWSS3Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.AWSS3Endpoint)
			o.UsePathStyle = true
		}
	})

	return &FileService{db: db, s3Client: s3Client, bucket: cfg.AWSS3Bucket}, nil
}

func (s *FileService) UploadFile(
	orgID, uploaderID uuid.UUID,
	projectID *uuid.UUID,
	ownerType models.FileOwnerType,
	ownerID uuid.UUID,
	file multipart.File,
	header *multipart.FileHeader,
) (*models.FileAsset, error) {

	ext := filepath.Ext(header.Filename)
	uniqueName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	s3Key := buildS3Key(orgID, ownerType, ownerID, uniqueName)

	// Upload to S3 (no ACL - use presigned URLs for access)
	_, err := s.s3Client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(s3Key),
		Body:        file,
		ContentType: aws.String(header.Header.Get("Content-Type")),
		ContentDisposition: aws.String(
			fmt.Sprintf(`inline; filename="%s"`, header.Filename),
		),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upload file to S3: %w", err)
	}

	// Generate presigned URL for immediate access (1 hour expiry)
	presignedURL, err := s.GetSignedURL(s3Key, 1*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	// Store base URL in DB, but return presigned URL
	s3URL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s",
		s.bucket, appconfig.App.AWSRegion, s3Key)

	if appconfig.App.AWSS3Endpoint != "" {
		s3URL = fmt.Sprintf("%s/%s/%s", appconfig.App.AWSS3Endpoint, s.bucket, s3Key)
	}

	asset := &models.FileAsset{}
	var pID interface{}
	if projectID != nil {
		pID = *projectID
	}

	err = s.db.QueryRow(`
		INSERT INTO file_assets (
			organization_id, owner_type, owner_id, project_id,
			file_name, original_name, file_size, mime_type,
			s3_key, s3_url, uploaded_by
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING id, organization_id, owner_type, owner_id, project_id,
		          file_name, original_name, file_size, mime_type, s3_key, s3_url, uploaded_by, created_at
	`,
		orgID, ownerType, ownerID, pID,
		uniqueName, header.Filename, header.Size, header.Header.Get("Content-Type"),
		s3Key, s3URL, uploaderID,
	).Scan(
		&asset.ID, &asset.OrganizationID, &asset.OwnerType, &asset.OwnerID, &asset.ProjectID,
		&asset.FileName, &asset.OriginalName, &asset.FileSize, &asset.MimeType,
		&asset.S3Key, &asset.S3URL, &asset.UploadedBy, &asset.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save file record: %w", err)
	}

	// Return presigned URL for immediate frontend use
	asset.S3URL = presignedURL
	return asset, nil
}

func (s *FileService) GetSignedURL(s3Key string, expiry time.Duration) (string, error) {
	presigner := s3.NewPresignClient(s.s3Client)
	req, err := presigner.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s3Key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *FileService) GetFilesByOwner(ownerType models.FileOwnerType, ownerID uuid.UUID) ([]models.FileAsset, error) {
	rows, err := s.db.Query(`
		SELECT f.id, f.organization_id, f.owner_type, f.owner_id, f.project_id,
		       f.file_name, f.original_name, f.file_size, f.mime_type,
		       f.s3_key, f.s3_url, f.uploaded_by, f.created_at,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') as uploader_name
		FROM file_assets f
		LEFT JOIN employees e ON e.id = f.uploaded_by
		WHERE f.owner_type = $1 AND f.owner_id = $2
		ORDER BY f.created_at ASC
	`, ownerType, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []models.FileAsset
	for rows.Next() {
		var f models.FileAsset
		var projID sql.NullString
		var uploaderName sql.NullString
		rows.Scan(
			&f.ID, &f.OrganizationID, &f.OwnerType, &f.OwnerID, &projID,
			&f.FileName, &f.OriginalName, &f.FileSize, &f.MimeType,
			&f.S3Key, &f.S3URL, &f.UploadedBy, &f.CreatedAt, &uploaderName,
		)
		if projID.Valid {
			id, _ := uuid.Parse(projID.String)
			f.ProjectID = &id
		}
		if uploaderName.Valid {
			f.UploaderName = uploaderName.String
		}
		// Generate fresh presigned URL for each file
		presignedURL, err := s.GetSignedURL(f.S3Key, 1*time.Hour)
		if err == nil {
			f.S3URL = presignedURL
		}
		files = append(files, f)
	}
	return files, nil
}

func (s *FileService) DeleteFile(fileID, requesterID uuid.UUID) error {
	var s3Key string
	var uploaderID uuid.UUID
	err := s.db.QueryRow(`SELECT s3_key, uploaded_by FROM file_assets WHERE id = $1`, fileID).Scan(&s3Key, &uploaderID)
	if err != nil {
		return fmt.Errorf("file not found")
	}

	// Only uploader can delete
	if uploaderID != requesterID {
		return fmt.Errorf("not authorized to delete this file")
	}

	_, err = s.s3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete from S3: %w", err)
	}

	s.db.Exec(`DELETE FROM file_assets WHERE id = $1`, fileID)
	return nil
}

func buildS3Key(orgID uuid.UUID, ownerType models.FileOwnerType, ownerID uuid.UUID, filename string) string {
	return fmt.Sprintf("org/%s/%s/%s/%s", orgID, ownerType, ownerID, filename)
}

func IsAllowedMimeType(mime string) bool {
	allowed := []string{
		"image/jpeg", "image/png", "image/gif", "image/webp",
		"application/pdf",
		"application/octet-stream",
		"application/zip", "application/x-zip-compressed",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"video/mp4", "video/avi", "video/quicktime",
		"text/plain",
		"model/step", "model/stl",
	}
	mime = strings.ToLower(mime)
	for _, a := range allowed {
		if a == mime {
			return true
		}
	}
	// Allow CAD-like types by extension
	return strings.HasPrefix(mime, "image/") || strings.HasPrefix(mime, "application/")
}

func (s *FileService) UploadAvatar(
	orgID, employeeID uuid.UUID,
	file multipart.File,
	header *multipart.FileHeader,
) (string, error) {
	ext := filepath.Ext(header.Filename)
	uniqueName := fmt.Sprintf("avatar_%s_%d%s", employeeID, time.Now().Unix(), ext)
	s3Key := fmt.Sprintf("org/%s/avatars/%s", orgID, uniqueName)

	_, err := s.s3Client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(s3Key),
		Body:        file,
		ContentType: aws.String(header.Header.Get("Content-Type")),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload avatar to S3: %w", err)
	}

	s3URL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s",
		s.bucket, appconfig.App.AWSRegion, s3Key)

	if appconfig.App.AWSS3Endpoint != "" {
		s3URL = fmt.Sprintf("%s/%s/%s", appconfig.App.AWSS3Endpoint, s.bucket, s3Key)
	}

	return s3URL, nil
}

func (s *FileService) DeleteAvatar(avatarURL string) {
	if avatarURL == "" {
		return
	}
	key := extractS3KeyFromURL(avatarURL, s.bucket)
	if key == "" {
		return
	}
	_, _ = s.s3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
}

func extractS3KeyFromURL(s3URL, bucket string) string {
	// Look for bucket name in URL
	idx := strings.Index(s3URL, "/"+bucket+"/")
	if idx != -1 {
		return s3URL[idx+len(bucket)+2:]
	}
	// Otherwise look for standard amazonaws.com format: https://<bucket>.s3.<region>.amazonaws.com/<key>
	prefix := ".amazonaws.com/"
	idx = strings.Index(s3URL, prefix)
	if idx != -1 {
		return s3URL[idx+len(prefix):]
	}
	return ""
}


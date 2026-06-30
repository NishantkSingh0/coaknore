package files

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// S3Client wraps the AWS S3 client with helpers.
type S3Client struct {
	client     *s3.Client
	bucket     string
	region     string
	publicBase string // optional override, e.g. CloudFront domain
}

// NewS3Client creates an S3 client from environment variables.
func NewS3Client() (*S3Client, error) {
	region := os.Getenv("AWS_REGION")
	bucket := os.Getenv("AWS_S3_BUCKET")
	keyID := os.Getenv("AWS_ACCESS_KEY_ID")
	secret := os.Getenv("AWS_SECRET_ACCESS_KEY")

	if region == "" || bucket == "" || keyID == "" || secret == "" {
		return nil, fmt.Errorf("AWS S3 environment variables are not fully set")
	}

	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(keyID, secret, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &S3Client{
		client:     s3.NewFromConfig(cfg),
		bucket:     bucket,
		region:     region,
		publicBase: strings.TrimSuffix(os.Getenv("AWS_S3_PUBLIC_BASE_URL"), "/"),
	}, nil
}

// PublicURL returns a stable, non-expiring URL for an object key.
func (c *S3Client) PublicURL(key string) string {
	if c.publicBase != "" {
		return fmt.Sprintf("%s/%s", c.publicBase, key)
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", c.bucket, c.region, key)
}

// PresignedReadURL returns a temporary URL for reading a private S3 object.
func (c *S3Client) PresignedReadURL(ctx context.Context, key string, expires time.Duration) (string, time.Time, error) {
	presigner := s3.NewPresignClient(c.client)
	expiresAt := time.Now().Add(expires)
	out, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		return "", time.Time{}, err
	}
	return out.URL, expiresAt, nil
}

// extractKeyFromStored returns the S3 object key from a stored key or legacy URL.
func (c *S3Client) extractKeyFromStored(stored string) string {
	if !strings.HasPrefix(stored, "http://") && !strings.HasPrefix(stored, "https://") {
		return stored
	}

	u, err := url.Parse(stored)
	if err != nil {
		return ""
	}

	// Virtual-hosted style: https://bucket.s3.region.amazonaws.com/key
	hostPrefix := fmt.Sprintf("%s.s3.", c.bucket)
	if strings.Contains(u.Host, hostPrefix) {
		key := strings.TrimPrefix(u.Path, "/")
		return key
	}

	// Path-style: https://s3.region.amazonaws.com/bucket/key
	pathPrefix := "/" + c.bucket + "/"
	if strings.HasPrefix(u.Path, pathPrefix) {
		return strings.TrimPrefix(u.Path, pathPrefix)
	}

	// Custom public base (e.g. CloudFront)
	if c.publicBase != "" {
		base := strings.TrimSuffix(c.publicBase, "/")
		if strings.HasPrefix(stored, base+"/") {
			return strings.TrimPrefix(stored, base+"/")
		}
	}

	return ""
}

// StorageKey returns the value if it looks like an S3 object key, otherwise nil.
func StorageKey(stored *string) *string {
	if stored == nil || *stored == "" {
		return nil
	}
	if strings.HasPrefix(*stored, "http://") || strings.HasPrefix(*stored, "https://") {
		return nil
	}
	return stored
}

// ResolveURL converts a stored S3 key (or legacy URL) to a readable URL.
func (c *S3Client) ResolveURL(ctx context.Context, stored *string) *string {
	if stored == nil || *stored == "" {
		return nil
	}
	key := c.extractKeyFromStored(*stored)
	if key == "" {
		return stored
	}
	url, _, err := c.PresignedReadURL(ctx, key, 15*time.Minute)
	if err != nil {
		return stored
	}
	return &url
}

// PutObjectACL sets public-read on an existing object (for legacy private uploads).
func (c *S3Client) MakePublic(ctx context.Context, key string) error {
	_, err := c.client.PutObjectAcl(ctx, &s3.PutObjectAclInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
		ACL:    types.ObjectCannedACLPublicRead,
	})
	return err
}

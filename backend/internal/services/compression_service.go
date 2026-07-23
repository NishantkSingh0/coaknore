package services

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	appconfig "github.com/pms/backend/internal/config"
	_ "golang.org/x/image/webp"
)

type CompressionService struct {
	maxImageWidth  int
	maxImageHeight int
	imageQuality   int
	enablePDF      bool
	enabled        bool
}

func NewCompressionService() *CompressionService {
	cfg := appconfig.App
	return &CompressionService{
		maxImageWidth:  cfg.MaxImageWidth,
		maxImageHeight: cfg.MaxImageHeight,
		imageQuality:   cfg.ImageQuality,
		enablePDF:      true,
		enabled:        cfg.EnableCompression,
	}
}

// CompressFile compresses the file based on its MIME type
func (cs *CompressionService) CompressFile(file multipart.File, header *multipart.FileHeader) (multipart.File, *multipart.FileHeader, error) {
	// Check if compression is enabled
	if !cs.enabled {
		file.Seek(0, 0)
		return file, header, nil
	}

	// Reset file pointer
	file.Seek(0, 0)

	mimeType := header.Header.Get("Content-Type")
	ext := strings.ToLower(filepath.Ext(header.Filename))

	switch {
	case cs.isImage(mimeType, ext):
		return cs.compressImage(file, header)
	case mimeType == "application/pdf" || ext == ".pdf":
		return cs.compressPDF(file, header)
	default:
		// For other files, apply gzip compression if beneficial
		return cs.compressGeneric(file, header)
	}
}

func (cs *CompressionService) isImage(mimeType, ext string) bool {
	imageMimes := []string{"image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"}
	imageExts := []string{".jpg", ".jpeg", ".png", ".gif", ".webp"}

	for _, m := range imageMimes {
		if strings.EqualFold(mimeType, m) {
			return true
		}
	}
	for _, e := range imageExts {
		if strings.EqualFold(ext, e) {
			return true
		}
	}
	return false
}

func (cs *CompressionService) compressImage(file multipart.File, header *multipart.FileHeader) (multipart.File, *multipart.FileHeader, error) {
	// Read the entire file into memory
	file.Seek(0, 0)
	imgData, err := io.ReadAll(file)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read image: %w", err)
	}

	// Decode image
	img, format, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		// If decoding fails, return original file
		file.Seek(0, 0)
		return file, header, nil
	}

	// Resize if necessary
	bounds := img.Bounds()
	if bounds.Dx() > cs.maxImageWidth || bounds.Dy() > cs.maxImageHeight {
		img = imaging.Resize(img, cs.maxImageWidth, cs.maxImageHeight, imaging.Lanczos)
	}

	// Encode with compression
	var buf bytes.Buffer
	ext := strings.ToLower(filepath.Ext(header.Filename))

	switch {
	case ext == ".jpg" || ext == ".jpeg" || format == "jpeg":
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: cs.imageQuality})
	case ext == ".png" || format == "png":
		encoder := png.Encoder{
			CompressionLevel: png.BestCompression,
		}
		err = encoder.Encode(&buf, img)
	case ext == ".webp" || format == "webp":
		// For WebP, convert to JPEG with compression since WebP encoding requires external libs
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: cs.imageQuality})
	default:
		// Default to JPEG for unknown formats
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: cs.imageQuality})
	}

	if err != nil {
		file.Seek(0, 0)
		return file, header, nil
	}

	// Create new multipart.File from compressed data
	compressedFile := &bytesReadCloser{data: buf.Bytes()}
	newHeader := &multipart.FileHeader{
		Filename: header.Filename,
		Size:     int64(buf.Len()),
		Header:   header.Header,
	}

	return compressedFile, newHeader, nil
}

func (cs *CompressionService) compressPDF(file multipart.File, header *multipart.FileHeader) (multipart.File, *multipart.FileHeader, error) {
	// For PDF compression, we'll use a basic approach
	// Note: Full PDF compression requires external tools like Ghostscript
	// For now, we'll return the original file but log that compression is available
	// In production, you would integrate with Ghostscript or similar
	
	file.Seek(0, 0)
	return file, header, nil
}

func (cs *CompressionService) compressGeneric(file multipart.File, header *multipart.FileHeader) (multipart.File, *multipart.FileHeader, error) {
	// For generic files, we could apply gzip compression
	// However, this might not be beneficial for already compressed formats (zip, mp4, etc.)
	// For now, return original file
	
	file.Seek(0, 0)
	return file, header, nil
}

// bytesReadCloser implements multipart.File interface
type bytesReadCloser struct {
	data []byte
	pos  int
}

func (b *bytesReadCloser) Read(p []byte) (n int, err error) {
	if b.pos >= len(b.data) {
		return 0, io.EOF
	}
	n = copy(p, b.data[b.pos:])
	b.pos += n
	return n, nil
}

func (b *bytesReadCloser) ReadAt(p []byte, off int64) (n int, err error) {
	if off < 0 || off >= int64(len(b.data)) {
		return 0, io.EOF
	}
	n = copy(p, b.data[off:])
	if int(off)+n >= len(b.data) {
		err = io.EOF
	}
	return n, nil
}

func (b *bytesReadCloser) Close() error {
	return nil
}

func (b *bytesReadCloser) Seek(offset int64, whence int) (int64, error) {
	var newPos int
	switch whence {
	case io.SeekStart:
		newPos = int(offset)
	case io.SeekCurrent:
		newPos = b.pos + int(offset)
	case io.SeekEnd:
		newPos = len(b.data) + int(offset)
	default:
		return 0, fmt.Errorf("invalid whence")
	}
	if newPos < 0 || newPos > len(b.data) {
		return 0, fmt.Errorf("invalid position")
	}
	b.pos = newPos
	return int64(newPos), nil
}

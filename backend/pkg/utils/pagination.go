package utils

import (
	"math"
	"net/http"
	"strconv"
)

type Pagination struct {
	Page     int
	PageSize int
	Offset   int
	Search   string
}

func GetPagination(r *http.Request) Pagination {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	search := r.URL.Query().Get("search")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	return Pagination{
		Page:     page,
		PageSize: pageSize,
		Offset:   (page - 1) * pageSize,
		Search:   search,
	}
}

func BuildPaginatedResponse(data interface{}, total, page, pageSize int) map[string]interface{} {
	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	return map[string]interface{}{
		"data":        data,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	}
}

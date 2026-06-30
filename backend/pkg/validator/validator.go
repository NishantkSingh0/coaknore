package validator

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
)

var v = validator.New()

// ValidationError holds field-level validation info.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("field %s: %s", e.Field, e.Message)
}

// Validate runs struct validation and returns the first field error.
func Validate(s interface{}) *ValidationError {
	err := v.Struct(s)
	if err == nil {
		return nil
	}
	for _, fe := range err.(validator.ValidationErrors) {
		field := strings.ToLower(fe.Field())
		return &ValidationError{
			Field:   field,
			Message: humanize(fe),
		}
	}
	return nil
}

func humanize(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "this field is required"
	case "email":
		return "must be a valid email address"
	case "min":
		return fmt.Sprintf("must be at least %s characters", fe.Param())
	case "max":
		return fmt.Sprintf("must be at most %s characters", fe.Param())
	case "len":
		return fmt.Sprintf("must be exactly %s characters", fe.Param())
	case "gt":
		return fmt.Sprintf("must be greater than %s", fe.Param())
	case "oneof":
		return fmt.Sprintf("must be one of: %s", fe.Param())
	}
	return fe.Error()
}

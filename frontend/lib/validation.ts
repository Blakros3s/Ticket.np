// Form validation utilities

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  email?: boolean;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  customMessage?: string;
}

export function validateField(value: any, rules: ValidationRules, fieldName: string): string | null {
  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`;
  }

  // Skip other validations if value is empty and not required
  if (!value && !rules.required) {
    return null;
  }

  const strValue = String(value);

  // Min length check
  if (rules.minLength && strValue.length < rules.minLength) {
    return `${fieldName} must be at least ${rules.minLength} characters`;
  }

  // Max length check
  if (rules.maxLength && strValue.length > rules.maxLength) {
    return `${fieldName} must be no more than ${rules.maxLength} characters`;
  }

  // Email validation
  if (rules.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(strValue)) {
      return `Please enter a valid email address`;
    }
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(strValue)) {
    return `${fieldName} format is invalid`;
  }

  // Custom validation
  if (rules.custom && !rules.custom(value)) {
    return rules.customMessage || `${fieldName} is invalid`;
  }

  return null;
}

export function validateForm(
  values: Record<string, any>,
  rules: Record<string, ValidationRules>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, fieldRules] of Object.entries(rules)) {
    const error = validateField(values[field], fieldRules, field);
    if (error) {
      errors.push({ field, message: error });
    }
  }

  return errors;
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Common validation patterns
export const patterns = {
  username: /^[a-zA-Z0-9_-]{3,20}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  phone: /^\+?[\d\s-()]{10,20}$/,
  url: /^https?:\/\/.+/,
};

// Validation messages
export const messages = {
  required: (field: string) => `${field} is required`,
  minLength: (field: string, min: number) => `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) => `${field} must be no more than ${max} characters`,
  email: () => 'Please enter a valid email address',
  password: () => 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
};

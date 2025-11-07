/**
 * Authentication Service
 * Handles authentication with the Docker backend API
 */

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  first_name: string;
  last_name: string;
  contact_number: string;
  password: string;
  password_confirm: string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

class AuthService {
  private apiUrl: string;

  constructor() {
    // In development, use Vite proxy (empty string means relative URLs)
    // In production, use environment variable
    this.apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001');
  }

  /**
   * Login with email and password
   * Endpoint: POST /api/users/login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Parse field-specific errors from Django REST Framework
        const errors: string[] = [];
        
        // Check for field-specific errors
        if (typeof data === 'object' && data !== null) {
          for (const [field, messages] of Object.entries(data)) {
            if (Array.isArray(messages)) {
              // Format: { "email": ["Error 1", "Error 2"] }
              errors.push(`${field.replace(/_/g, ' ')}: ${messages.join(', ')}`);
            } else if (typeof messages === 'string') {
              // Format: { "email": "Error message" }
              errors.push(`${field.replace(/_/g, ' ')}: ${messages}`);
            }
          }
        }
        
        // If we found field errors, show them
        if (errors.length > 0) {
          throw new Error(errors.join('\n'));
        }
        
        // Fallback to generic message
        throw new Error(data.message || data.error || 'Login failed');
      }

      // Store token if provided
      if (data.token) {
        localStorage.setItem('fincube_auth_token', data.token);
      }
      
      return {
        success: true,
        token: data.token,
        message: data.message,
        user: data.user,
      };
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide specific error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot connect to authentication service. Please ensure the service is running on port 3001.');
      }
      
      throw new Error(error.message || 'Failed to connect to authentication service');
    }
  }

  /**
   * Register a new user
   * Endpoint: POST /api/users/registration
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/api/users/registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          contact_number: data.contact_number,
          password: data.password,
          password_confirm: data.password_confirm,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Parse field-specific errors from Django REST Framework
        const errors: string[] = [];
        
        // Check for field-specific errors
        if (typeof result === 'object' && result !== null) {
          for (const [field, messages] of Object.entries(result)) {
            if (Array.isArray(messages)) {
              // Format: { "email": ["Error 1", "Error 2"] }
              errors.push(`${field.replace(/_/g, ' ')}: ${messages.join(', ')}`);
            } else if (typeof messages === 'string') {
              // Format: { "email": "Error message" }
              errors.push(`${field.replace(/_/g, ' ')}: ${messages}`);
            }
          }
        }
        
        // If we found field errors, show them
        if (errors.length > 0) {
          throw new Error(errors.join('\n'));
        }
        
        // Fallback to generic message
        throw new Error(result.message || result.error || 'Registration failed');
      }

      return {
        success: true,
        message: result.message || 'Registration successful',
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Provide specific error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot connect to authentication service. Please ensure the service is running on port 3001.');
      }
      
      throw new Error(error.message || 'Failed to connect to authentication service');
    }
  }

  /**
   * Logout and clear stored credentials
   */
  logout(): void {
    localStorage.removeItem('fincube_auth_token');
    localStorage.removeItem('fincube_auth');
  }

  /**
   * Get stored auth token
   */
  getToken(): string | null {
    return localStorage.getItem('fincube_auth_token');
  }

  /**
   * Check if user has a valid token
   */
  hasToken(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();

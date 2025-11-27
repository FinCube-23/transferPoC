/**
 * Organization Service
 * Handles organization-related API calls
 */

export interface OrganizationAdmin {
  id: number;
  email: string;
  full_name: string;
  status: string;
  phone_number: string;
  wallet_address: string | null;
}

export interface Organization {
  id: number;
  name: string;
  email: string;
  type: string;
  address: string;
  legal_entity_identifier: string;
  offchain_status: string;
  organization_admin: OrganizationAdmin;
  onchain_status: string | null;
  members: number[];
  created_at: string;
  updated_at: string;
}

export interface OrganizationsResponse {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface JoinOrganizationPayload {
  user_id: number;
  organization_id: number;
}

/**
 * Parse error message to extract clean string from ErrorDetail format
 * Example: "{'field': [ErrorDetail(string='Error message', code='invalid')]}" -> "Error message"
 */
function parseErrorMessage(message: string): string {
  if (!message) return "An error occurred";

  // Try to extract string from ErrorDetail format
  const errorDetailMatch = message.match(/string='([^']+)'/);
  if (errorDetailMatch && errorDetailMatch[1]) {
    return errorDetailMatch[1];
  }

  // Try to extract from simple array format
  const simpleMatch = message.match(/:\s*\[['"]([^'"]+)['"]\]/);
  if (simpleMatch && simpleMatch[1]) {
    return simpleMatch[1];
  }

  // Return original message if no pattern matches
  return message;
}

class OrganizationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      import.meta.env.VITE_USER_MANAGEMENT_URL || "http://localhost:3001";
  }

  /**
   * Fetch all organizations
   * Endpoint: GET /api/organizations
   */
  async getOrganizations(accessToken: string): Promise<OrganizationsResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/organizations?is_active=true&status=approved`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch organizations");
      }

      const data: OrganizationsResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error("Get organizations error:", error);
      const cleanMessage = parseErrorMessage(
        error.message || "Failed to fetch organizations. Please try again."
      );
      throw new Error(cleanMessage);
    }
  }

  /**
   * Join an organization
   * Endpoint: POST /api/organizations/users
   */
  async joinOrganization(
    payload: JoinOrganizationPayload,
    accessToken: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/organizations/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Parse the error message to extract clean string
        const errorMessage = parseErrorMessage(
          data.message || JSON.stringify(data) || "Failed to join organization"
        );
        throw new Error(errorMessage);
      }

      return {
        success: true,
        message: data.message || "Successfully joined organization",
      };
    } catch (error: any) {
      console.error("Join organization error:", error);
      // Parse error message if it's in ErrorDetail format
      const cleanMessage = parseErrorMessage(
        error.message || "Failed to join organization. Please try again."
      );
      throw new Error(cleanMessage);
    }
  }
}

export const organizationService = new OrganizationService();

/**
 * Fraud Detection Service
 * Handles fraud detection API calls with caching and timeout
 */

import { ethers } from "ethers";

export interface FraudDetectionRequest {
  reference_number: string;
}

export interface FraudDetectionResult {
  result: string;
  fraud_probability: number;
  confidence: number;
}

export interface FraudScoreResult {
  user_ref_number: string;
  score: number;
  created_at: string;
  updated_at: string;
  last_result: string;
  last_confidence: number | null;
}

class FraudDetectionService {
  private apiUrl: string;
  private requestTimeout: number;

  constructor() {
    this.apiUrl = "http://localhost:8007";
    this.requestTimeout = 120000; // 120 seconds (2 minutes) - API can be very slow
  }

  /**
   * Convert reference number to bytes32 format using keccak256
   */
  private convertToBytes32(referenceNumber: string): string {
    // Use ethers.utils.id() which is keccak256 hash of the string
    return ethers.utils.id(referenceNumber);
  }

  /**
   * Get fraud detection score for a reference number
   * Always makes a fresh API call (no caching)
   * @param referenceNumber - The reference number to check for fraud (format: 0xAddress_uuid)
   */
  async getFraudScore(referenceNumber: string): Promise<FraudDetectionResult> {
    console.log("getFraudScore called for:", referenceNumber);
    console.log("Making API request for:", referenceNumber);

    // Convert reference number to hex format
    const hexRefNumber = this.convertToBytes32(referenceNumber);
    console.log("Converted to hex:", hexRefNumber);

    // Fetch from API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const requestBody: FraudDetectionRequest = {
        reference_number: hexRefNumber,
      };

      console.log("Sending request to:", `${this.apiUrl}/fraud/score`);
      console.log("Request body:", requestBody);

      const response = await fetch(`${this.apiUrl}/fraud/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(
          `API request failed with status ${response.status}: ${errorText}`
        );
      }

      const data: FraudDetectionResult = await response.json();
      console.log("Fraud detection result:", data);

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      console.error(
        `Fraud detection failed for ${referenceNumber}:`,
        error.message
      );
      console.error("Full error:", error);

      // Return "Offline" status instead of throwing error
      // This prevents UI from showing ugly error messages
      return {
        result: "Offline",
        fraud_probability: 0,
        confidence: 0,
      };
    }
  }

  /**
   * Get fraud score for a reference number (GET endpoint)
   * Used for transfer validation
   * @param referenceNumber - The reference number to check (format: 0xAddress_uuid)
   */
  async getFraudScoreByRefNumber(
    referenceNumber: string
  ): Promise<FraudScoreResult> {
    console.log("getFraudScoreByRefNumber called for:", referenceNumber);

    // Convert reference number to hex format
    const hexRefNumber = this.convertToBytes32(referenceNumber);
    console.log("Converted to hex:", hexRefNumber);

    // Fetch from API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const url = `${this.apiUrl}/fraud/score/${hexRefNumber}`;
      console.log("Sending GET request to:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(
          `API request failed with status ${response.status}: ${errorText}`
        );
      }

      const data: FraudScoreResult = await response.json();
      console.log("Fraud score result:", data);

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      console.error(
        `Fraud score fetch failed for ${referenceNumber}:`,
        error.message
      );
      console.error("Full error:", error);

      throw error; // Re-throw to handle in calling code
    }
  }

  /**
   * Validate transfer by checking fraud scores for both sender and receiver
   * @param senderRefNumber - Sender reference number
   * @param receiverRefNumber - Receiver reference number
   * @param threshold - Score threshold (default: 0.8, range 0-1, ≥0.8 = untrusted)
   * @returns Object with isValid flag and error message if invalid
   */
  async validateTransfer(
    senderRefNumber: string,
    receiverRefNumber: string,
    threshold: number = 0.8
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      console.log("Validating transfer...");
      console.log("Sender:", senderRefNumber);
      console.log("Receiver:", receiverRefNumber);
      console.log("Threshold:", threshold);

      // Check sender score
      const senderScore = await this.getFraudScoreByRefNumber(senderRefNumber);
      console.log("Sender score:", senderScore.score);

      if (senderScore.score >= threshold) {
        return {
          isValid: false,
          error: "Transfer Blocked due to suspicious activity",
        };
      }

      // Check receiver score
      const receiverScore = await this.getFraudScoreByRefNumber(
        receiverRefNumber
      );
      console.log("Receiver score:", receiverScore.score);

      if (receiverScore.score >= threshold) {
        return {
          isValid: false,
          error: "Receiver blocked due to suspicious activity",
        };
      }

      return { isValid: true };
    } catch (error: any) {
      console.error("Transfer validation error:", error);
      // If fraud detection service is down, allow transfer to proceed
      // (fail open rather than fail closed)
      return { isValid: true };
    }
  }

  /**
   * Get fraud scores for multiple reference numbers in parallel
   */
  async getFraudScores(
    referenceNumbers: string[]
  ): Promise<Map<string, FraudDetectionResult | Error>> {
    const results = new Map<string, FraudDetectionResult | Error>();

    await Promise.allSettled(
      referenceNumbers.map(async (refNumber) => {
        try {
          const result = await this.getFraudScore(refNumber);
          results.set(refNumber, result);
        } catch (error) {
          results.set(refNumber, error as Error);
        }
      })
    );

    return results;
  }

  /**
   * Check if fraud detection service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const fraudDetectionService = new FraudDetectionService();

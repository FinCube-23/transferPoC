/**
 * Fraud Detection Service
 * Handles fraud detection API calls with caching and timeout
 */

export interface FraudDetectionRequest {
    address: string;
    from_address?: string;
}

export interface FraudDetectionResult {
    result: string;
    fraud_probability: number;
    confidence: number;
}

interface CachedResult extends FraudDetectionResult {
    timestamp: number;
}

class FraudDetectionService {
    private apiUrl: string;
    private cacheExpiry: number;
    private requestTimeout: number;

    constructor() {
        this.apiUrl = 'http://localhost:8000';
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour
        this.requestTimeout = 120000; // 120 seconds (2 minutes) - API can be very slow
    }

    /**
     * Get fraud detection score for an address
     * Uses cache if available and not expired
     * @param address - The address to check for fraud
     * @param fromAddress - Optional: The sender address from the transaction
     */
    async getFraudScore(
        address: string,
        fromAddress?: string
    ): Promise<FraudDetectionResult> {
        // Check cache first
        const cached = this.getFromCache(address);
        if (cached) {
            return cached;
        }

        // Fetch from API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        try {
            const requestBody: FraudDetectionRequest = {
                address,
            };

            // Add optional from address if provided
            if (fromAddress) {
                requestBody.from_address = fromAddress;
            }

            const response = await fetch(`${this.apiUrl}/fraud/score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data: FraudDetectionResult = await response.json();

            // Cache the result
            this.saveToCache(address, data);

            return data;
        } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('Fraud detection request timed out');
            }

            throw new Error(error.message || 'Failed to fetch fraud detection score');
        }
    }

    /**
     * Get fraud scores for multiple addresses in parallel
     */
    async getFraudScores(addresses: string[]): Promise<Map<string, FraudDetectionResult | Error>> {
        const results = new Map<string, FraudDetectionResult | Error>();

        await Promise.allSettled(
            addresses.map(async (address) => {
                try {
                    const result = await this.getFraudScore(address);
                    results.set(address, result);
                } catch (error) {
                    results.set(address, error as Error);
                }
            })
        );

        return results;
    }

    /**
     * Get cached result if available and not expired
     */
    private getFromCache(address: string): FraudDetectionResult | null {
        try {
            const cacheKey = `fraud_cache_${address}`;
            const cached = localStorage.getItem(cacheKey);

            if (!cached) {
                return null;
            }

            const cachedData: CachedResult = JSON.parse(cached);
            const cacheAge = Date.now() - (cachedData.timestamp || 0);

            // Return cached data if less than 1 hour old
            if (cacheAge < this.cacheExpiry) {
                return {
                    result: cachedData.result,
                    fraud_probability: cachedData.fraud_probability,
                    confidence: cachedData.confidence,
                };
            }

            // Cache expired, remove it
            localStorage.removeItem(cacheKey);
            return null;
        } catch (e) {
            console.error('Cache read error:', e);
            return null;
        }
    }

    /**
     * Save result to cache
     */
    private saveToCache(address: string, data: FraudDetectionResult): void {
        try {
            const cacheKey = `fraud_cache_${address}`;
            const cacheData: CachedResult = {
                ...data,
                timestamp: Date.now(),
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
            console.error('Cache write error:', e);
        }
    }

    /**
     * Clear all cached fraud detection results
     */
    clearCache(): void {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach((key) => {
                if (key.startsWith('fraud_cache_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.error('Cache clear error:', e);
        }
    }

    /**
     * Check if fraud detection service is available
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/health`, {
                method: 'GET',
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

export const fraudDetectionService = new FraudDetectionService();

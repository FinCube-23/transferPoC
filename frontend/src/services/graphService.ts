import { ethers } from "ethers";

export interface GraphTransfer {
  id: string;
  from: string;
  to: string;
  amount: string;
  memo: string;
  memoHash: string;
  nullifier: string;
  sender_reference_number: string;
  receiver_reference_number: string;
  transactionHash: string;
  blockNumber: string;
  blockTimestamp: string;
}

export interface ParsedTransfer {
  sender: string;
  recipient: string;
  amount: string;
  purpose: string;
  memo?: string;
  nullifier?: string;
  timestamp: number;
  txHash?: string;
  fraudResult?: string;
  fraudProbability?: number;
  fraudConfidence?: number;
}

/**
 * Normalize a candidate string to a valid transaction hash if possible.
 * Handles Graph ids like "0xabc...-0" by extracting the 0x-prefixed 64-hex value.
 */
function normalizeHash(candidate?: string | null): string | undefined {
  if (!candidate) return undefined;
  const s = String(candidate).trim();
  // try to find a 0x + 64 hex string anywhere in the candidate
  const m = s.match(/0x[a-fA-F0-9]{64}/);
  if (m) return m[0];
  // if candidate contains a dash (common id format: txHash-logIndex), take the left part
  if (s.includes("-")) {
    const left = s.split("-")[0];
    if (/^0x[a-fA-F0-9]{64}$/.test(left)) return left;
    const mm = left.match(/0x[a-fA-F0-9]{64}/);
    if (mm) return mm[0];
  }
  // if it's already a plausible tx hash length, return trimmed-first-66
  if (s.startsWith("0x") && s.length >= 66) return s.slice(0, 66);
  // fallback to undefined so caller can decide
  return undefined;
}

/**
 * Convert reference number to bytes32 format using keccak256
 */
function convertToBytes32(referenceNumber: string): string {
  // Use ethers.id() which is keccak256 hash of the string
  // This ensures we get a consistent 32-byte value
  return ethers.utils.id(referenceNumber);
}

/**
 * Fetch transfers from The Graph filtered by sender reference number
 */
export async function fetchTransfersFromGraph(
  referenceNumber: string
): Promise<ParsedTransfer[]> {
  const endpoint =
    "https://api.studio.thegraph.com/query/93678/fincube-subgraph/v0.0.2";

  // Convert reference number to bytes32 format for GraphQL query
  const bytes32RefNumber = convertToBytes32(referenceNumber);
  
  console.log(`Original reference number: ${referenceNumber}`);
  console.log(`Converted to bytes32: ${bytes32RefNumber}`);

  // Query with sender_reference_number filter
  const query = `
        query {
            stablecoinTransfers(
                first: 100, 
                orderBy: blockNumber, 
                orderDirection: desc,
                where: { sender_reference_number: "${bytes32RefNumber}" }
            ) {
                id
                from
                to
                amount
                memo
                memoHash
                nullifier
                sender_reference_number
                receiver_reference_number
                transactionHash
                blockNumber
                blockTimestamp
            }
        }
    `;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const json = await res.json();
    const items: GraphTransfer[] = json.data?.stablecoinTransfers || [];

    console.log(
      `Fetched ${items.length} transfers for reference number: ${referenceNumber}`
    );

    const parsedTransfers: ParsedTransfer[] = [];

    for (const it of items) {
      // Parse memo JSON to extract sender and receiver reference numbers
      let actualPurpose = "";
      let senderRefNum = "";
      let receiverRefNum = "";
      let memoData: any = null;

      if (it.memo) {
        // The Graph might return memo as hex string, convert if needed
        let memoString = it.memo;
        if (memoString.startsWith("0x")) {
          try {
            memoString = ethers.utils.toUtf8String(memoString);
          } catch (e) {
            console.log("HEX CONVERSION FAILED:", e);
          }
        }

        try {
          memoData = JSON.parse(memoString);

          // Extract sender and receiver reference numbers from memo
          senderRefNum = memoData?.sender_reference_number || "";
          receiverRefNum = memoData?.receiver_reference_number || "";

          // Try to extract purpose from various possible locations
          if (memoData?.TransactionInformation?.Purpose) {
            actualPurpose = memoData.TransactionInformation.Purpose;
          } else if (memoData?.purpose) {
            actualPurpose = memoData.purpose;
          }
        } catch (e) {
          console.log("MEMO PARSE FAILED for tx:", it.id);
        }
      }

      const rawCandidate = it.transactionHash || it.id;
      const candidateHash = normalizeHash(rawCandidate) || rawCandidate;

      parsedTransfers.push({
        sender: senderRefNum || it.from, // Use reference number from memo, fallback to wallet address
        recipient: receiverRefNum || it.to, // Use reference number from memo, fallback to wallet address
        amount: `${parseInt(it.amount) / 1e6} USDC`,
        purpose: actualPurpose || "Transfer",
        memo: it.memo, // Pass the raw memo from GraphQL
        timestamp: parseInt(it.blockTimestamp) * 1000,
        txHash: candidateHash,
      });
    }

    return parsedTransfers;
  } catch (e) {
    console.error("Graph fetch error", e);
    return [];
  }
}

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
 * Fetch transfers from The Graph filtered by sender reference number
 */
export async function fetchTransfersFromGraph(
  referenceNumber: string
): Promise<ParsedTransfer[]> {
  const endpoint =
    "https://api.studio.thegraph.com/query/93678/fincube-subgraph/v0.0.2";

  // Fetch all transfers (no filtering by address in query)
  const query = `
        query {
            stablecoinTransfers(
                first: 100, 
                orderBy: blockNumber, 
                orderDirection: desc
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
    const allTransfers: GraphTransfer[] = json.data?.stablecoinTransfers || [];

    console.log(`Fetched ${allTransfers.length} total transfers from Graph`);

    // Filter by sender reference number from memo
    const items: GraphTransfer[] = allTransfers.filter((transfer) => {
      if (!transfer.memo) return false;

      try {
        let memoString = transfer.memo;

        // Convert hex to string if needed
        if (memoString.startsWith("0x")) {
          try {
            memoString = ethers.utils.toUtf8String(memoString);
          } catch (e) {
            console.log("HEX CONVERSION FAILED for transfer:", transfer.id);
            return false;
          }
        }

        const memoData = JSON.parse(memoString);
        const senderRefNum = memoData?.sender_reference_number;

        // Match against the provided reference number
        return senderRefNum === referenceNumber;
      } catch (e) {
        console.log("Failed to parse memo for transfer:", transfer.id);
        return false;
      }
    });

    console.log(
      `Filtered to ${items.length} transfers for reference number: ${referenceNumber}`
    );

    const parsedTransfers: ParsedTransfer[] = [];

    for (const it of items) {
      // Parse memo JSON to extract additional information
      let actualPurpose = "";
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
        sender: it.from,
        recipient: it.to,
        amount: `${parseInt(it.amount) / 1e6} USDC`,
        purpose: actualPurpose || "Transfer",
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

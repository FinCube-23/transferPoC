import { ethers } from "ethers"

export interface GraphTransfer {
    id: string
    from: string
    to: string
    amount: string
    memo: string
    memoHash: string
    nullifier: string
    txHash: string
    blockNumber: string
    timestamp: string
}

export interface ParsedTransfer {
    sender: string
    recipient: string
    amount: string
    purpose: string
    nullifier?: string
    timestamp: number
    txHash?: string
    fraudResult?: string
    fraudProbability?: number
    fraudConfidence?: number
}

/**
 * Normalize a candidate string to a valid transaction hash if possible.
 * Handles Graph ids like "0xabc...-0" by extracting the 0x-prefixed 64-hex value.
 */
function normalizeHash(candidate?: string | null): string | undefined {
    if (!candidate) return undefined
    const s = String(candidate).trim()
    // try to find a 0x + 64 hex string anywhere in the candidate
    const m = s.match(/0x[a-fA-F0-9]{64}/)
    if (m) return m[0]
    // if candidate contains a dash (common id format: txHash-logIndex), take the left part
    if (s.includes("-")) {
        const left = s.split("-")[0]
        if (/^0x[a-fA-F0-9]{64}$/.test(left)) return left
        const mm = left.match(/0x[a-fA-F0-9]{64}/)
        if (mm) return mm[0]
    }
    // if it's already a plausible tx hash length, return trimmed-first-66
    if (s.startsWith("0x") && s.length >= 66) return s.slice(0, 66)
    // fallback to undefined so caller can decide
    return undefined
}

/**
 * Fetch transfers from The Graph for a given account
 */
export async function fetchTransfersFromGraph(
    account: string
): Promise<ParsedTransfer[]> {
    const endpoint =
        "https://api.studio.thegraph.com/query/112514/fincube-transfer-token/version/latest"

    const query = `
        query($addr: Bytes!) {
            sent: stablecoinTransfers(
                where: { from: $addr }, 
                first: 25, 
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
                txHash
                blockNumber
                timestamp
            }
            received: stablecoinTransfers(
                where: { to: $addr }, 
                first: 25, 
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
                txHash
                blockNumber
                timestamp
            }
        }
    `

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables: { addr: account } }),
        })

        const json = await res.json()
        const sent: GraphTransfer[] = json.data?.sent || []
        const received: GraphTransfer[] = json.data?.received || []
        const items: GraphTransfer[] = [...sent, ...received]

        const parsedTransfers: ParsedTransfer[] = []

        for (const it of items) {
            // Parse memo JSON to extract the actual purpose
            let actualPurpose = ""

            if (it.memo) {
                console.log("RAW MEMO FROM GRAPH:", it.memo, "TYPE:", typeof it.memo)

                // The Graph might return memo as hex string, convert if needed
                let memoString = it.memo
                if (memoString.startsWith("0x")) {
                    // Convert hex to string
                    try {
                        memoString = ethers.utils.toUtf8String(memoString)
                        console.log("CONVERTED HEX TO STRING:", memoString)
                    } catch (e) {
                        console.log("HEX CONVERSION FAILED:", e)
                    }
                }

                try {
                    const memoData = JSON.parse(memoString)
                    console.log("PARSED MEMO DATA:", memoData)
                    // Correct path is TransactionInformation.Purpose
                    if (memoData && memoData.TransactionInformation && memoData.TransactionInformation.Purpose) {
                        actualPurpose = memoData.TransactionInformation.Purpose
                        console.log("EXTRACTED PURPOSE:", actualPurpose)
                    }
                } catch (e) {
                    // If parsing fails, use the raw memo
                    console.log("MEMO PARSE FAILED, using raw:", memoString)
                    actualPurpose = memoString
                }
            } else {
                console.log("NO MEMO FIELD IN GRAPH DATA FOR TX:", it.id)
            }

            const rawCandidate = it.txHash || it.id
            const candidateHash = normalizeHash(rawCandidate) || rawCandidate

            parsedTransfers.push({
                sender: it.from,
                recipient: it.to,
                amount: `${parseInt(it.amount) / 1e6} USDC`,
                purpose: actualPurpose || "", // use extracted purpose or empty for 'Refund' fallback
                timestamp: parseInt(it.timestamp) * 1000,
                txHash: candidateHash,
            })
        }

        return parsedTransfers
    } catch (e) {
        console.error("Graph fetch error", e)
        return []
    }
}

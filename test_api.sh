#!/bin/bash

# Test script for Fraud Detection API

BASE_URL="http://localhost:8000"

echo "=== Ethereum Fraud Detection API Test ==="
echo ""

# 1. Health check
echo "1. Health Check"
curl -s "$BASE_URL/" | jq .
echo ""

# 2. Check stats
echo "2. Database Stats"
curl -s "$BASE_URL/data/stats" | jq .
echo ""

# 3. Score an address (example - replace with real address)
echo "3. Score Address"
read -p "Enter Ethereum address to check (or press Enter for example): " ADDRESS

if [ -z "$ADDRESS" ]; then
    ADDRESS="0x0000000000000000000000000000000000000000"
fi

echo "Scoring address: $ADDRESS"
curl -s -X POST "$BASE_URL/fraud/score" \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"$ADDRESS\"}" | jq .

echo ""
echo "=== Test Complete ==="

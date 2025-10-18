# FinCube Frontend Setup

This is a vanilla TypeScript frontend for interacting with the FinCube and FinCubeDAO smart contracts.

## Setup Instructions

1. Install dependencies:
```bash
cd frontend
yarn
```

2. Update contract addresses:
- Get the deployed addresses of your FinCube and FinCubeDAO contracts
- Update the `FINCUBE_ADDRESS` and `FINCUBEDAO_ADDRESS` constants in `src/main.ts`

3. Start the development server:
```bash
yarn dev
```

## Features
- Wallet connection with MetaMask
- View FinCube token balance
- Interact with FinCubeDAO
- Create and vote on proposals

## Structure
- `src/services/web3Service.ts` - Web3 connection management
- `src/services/contractService.ts` - Smart contract interactions
- `src/main.ts` - Main application logic
- `src/styles/main.css` - Application styles
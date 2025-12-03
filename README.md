# PrivacyPreservingVoterRegistry

A privacy-first decentralized voter registration and verification platform built on Ethereum, allowing citizens to register and verify eligibility without a centralized voter database. The system uses Full Homomorphic Encryption (FHE) to protect voter data, cross-verify eligibility with government records, and issue anonymous voting credentials while preventing double voting.

## Project Background

Traditional voter registration systems face challenges related to privacy, trust, and centralization:

• Risk of identity exposure: Citizens may avoid registration due to privacy concerns
• Centralized databases: Vulnerable to tampering or breaches
• Limited transparency: Citizens cannot verify their eligibility or registration status
• Double voting prevention: Difficult to enforce securely without exposing identities

PrivacyPreservingVoterRegistry addresses these issues by:

• Using blockchain smart contracts for immutable registration records
• Encrypting all voter data before submission so administrators cannot access raw content
• Performing FHE-based eligibility verification against government databases
• Issuing anonymous voting credentials while ensuring one vote per eligible citizen
• Maintaining transparency and trust without a central authority

## Features

### Core Functionality

• Voter Registration: Citizens submit encrypted registration data (name, DOB, ID)
• Eligibility Verification: FHE-based cross-check with government records
• Anonymous Credential Issuance: Provides voting credentials without revealing identity
• Immutable Records: Registration data is securely stored on-chain
• Transparent Access: All users can verify the number of registered voters without accessing raw data

### Privacy & Anonymity

• Client-side Encryption: Data encrypted before leaving the user device
• Fully Anonymous: No personal identity exposed on-chain
• Secure Verification: FHE ensures computations on encrypted data without revealing details
• Prevention of Double Voting: Anonymous credentials enforce single-use voting rights

## Architecture

### Smart Contracts

PrivacyPreservingVoterRegistry.sol (deployed on Ethereum)

• Handles encrypted voter registration submissions
• Stores immutable encrypted voter records on-chain
• Requests FHE-based eligibility verification
• Issues anonymous voting credentials upon successful verification
• Provides transparent access to verified voter counts

### Frontend Application

• React + TypeScript: Interactive UI for registration and verification
• Ethers.js: Blockchain interaction and contract calls
• Dashboard: View registration statistics and verification status
• Wallet Integration: Optional Ethereum wallet for secure interactions
• Real-time Updates: Fetches verified voter counts and credential issuance status

## Technology Stack

### Blockchain

• Solidity ^0.8.24: Smart contract development
• OpenZeppelin: Secure contract libraries
• Hardhat: Development, testing, and deployment
• Ethereum Sepolia Testnet: Deployment network

### Frontend

• React 18 + TypeScript: Modern UI framework
• Ethers.js: Blockchain interaction
• Tailwind + CSS: Styling and responsive layout
• Vercel: Deployment platform

## Installation

### Prerequisites

• Node.js 18+
• npm / yarn / pnpm package manager
• Ethereum wallet (MetaMask, WalletConnect, etc.)

### Setup

# Install dependencies

npm install

# Compile contracts

npx hardhat compile

# Deploy to network (configure hardhat.config.js first)

npx hardhat run deploy/deploy.ts --network sepolia

# Start the development server

cd frontend

# Install dependencies

npm install

# Run

npm run dev

## Usage

• Register Voter: Citizens submit encrypted registration information
• Verify Eligibility: Contract requests FHE-based verification
• Issue Anonymous Credential: Verified voters receive voting credentials
• View Statistics: Check number of verified voters without revealing identities
• Search & Filter: Find registration status or aggregate statistics

## Security Features

• Encrypted Registration: All data encrypted client-side
• Immutable Storage: Records cannot be tampered once on-chain
• Anonymous Verification: No personal information exposed
• FHE Processing: Ensures secure eligibility computation
• Double Voting Prevention: Anonymous credentials enforce single vote per citizen

## Future Enhancements

• Full Homomorphic Encryption (FHE) integration for more complex eligibility rules
• Multi-chain deployment for broader adoption
• Mobile-friendly optimized interface
• DAO governance for community-driven improvements
• Audit logging and verifiable credentials for external authorities

Built with ❤️ for privacy-preserving and secure voter registration on Ethereum

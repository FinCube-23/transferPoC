// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "./verifier/BaseZKHonkVerifier.sol";
import "./verifier/HonkVerificationKey.sol";

/**
 * @title HonkVerifier
 * @notice Modularized ZK-SNARK Verifier
 * @dev This contract uses modular components from the verifier/ directory:
 * - verifier/FrLib.sol - Field arithmetic
 * - verifier/HonkTypes.sol - Type definitions
 * - verifier/HonkVerificationKey.sol - Verification key
 * - verifier/ECOperations.sol - Elliptic curve operations
 * - verifier/CommitmentSchemeLib.sol - Commitment schemes
 * - verifier/ZKTranscriptLib.sol - Transcript generation
 * - verifier/RelationsLib.sol - Relation accumulation
 * - verifier/BaseZKHonkVerifier.sol - Main verification logic
 */
contract HonkVerifier is
    BaseZKHonkVerifier(N, LOG_N, VK_HASH, NUMBER_OF_PUBLIC_INPUTS)
{
    function loadVerificationKey()
        internal
        pure
        override
        returns (Honk.VerificationKey memory)
    {
        return HonkVerificationKey.loadVerificationKey();
    }
}

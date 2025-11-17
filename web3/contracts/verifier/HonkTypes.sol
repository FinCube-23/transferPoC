// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "./FrLib.sol";

uint256 constant CONST_PROOF_SIZE_LOG_N = 28;
uint256 constant NUMBER_OF_SUBRELATIONS = 28;
uint256 constant BATCHED_RELATION_PARTIAL_LENGTH = 8;
uint256 constant ZK_BATCHED_RELATION_PARTIAL_LENGTH = 9;
uint256 constant NUMBER_OF_ENTITIES = 41;
uint256 constant NUMBER_UNSHIFTED = 36;
uint256 constant NUMBER_TO_BE_SHIFTED = 5;
uint256 constant PAIRING_POINTS_SIZE = 16;
uint256 constant FIELD_ELEMENT_SIZE = 0x20;
uint256 constant GROUP_ELEMENT_SIZE = 0x40;
uint256 constant NUMBER_OF_ALPHAS = NUMBER_OF_SUBRELATIONS - 1;
uint256 constant SUBGROUP_SIZE = 256;

Fr constant SUBGROUP_GENERATOR = Fr.wrap(
    0x07b0c561a6148404f086204a9f36ffb0617942546750f230c893619174a57a76
);
Fr constant SUBGROUP_GENERATOR_INVERSE = Fr.wrap(
    0x204bd3277422fad364751ad938e2b5e6a54cf8c68712848a692c553d0329f5d6
);

enum WIRE {
    Q_M,
    Q_C,
    Q_L,
    Q_R,
    Q_O,
    Q_4,
    Q_LOOKUP,
    Q_ARITH,
    Q_RANGE,
    Q_ELLIPTIC,
    Q_MEMORY,
    Q_NNF,
    Q_POSEIDON2_EXTERNAL,
    Q_POSEIDON2_INTERNAL,
    SIGMA_1,
    SIGMA_2,
    SIGMA_3,
    SIGMA_4,
    ID_1,
    ID_2,
    ID_3,
    ID_4,
    TABLE_1,
    TABLE_2,
    TABLE_3,
    TABLE_4,
    LAGRANGE_FIRST,
    LAGRANGE_LAST,
    W_L,
    W_R,
    W_O,
    W_4,
    Z_PERM,
    LOOKUP_INVERSES,
    LOOKUP_READ_COUNTS,
    LOOKUP_READ_TAGS,
    W_L_SHIFT,
    W_R_SHIFT,
    W_O_SHIFT,
    W_4_SHIFT,
    Z_PERM_SHIFT
}

library Honk {
    struct G1Point {
        uint256 x;
        uint256 y;
    }

    struct VerificationKey {
        uint256 circuitSize;
        uint256 logCircuitSize;
        uint256 publicInputsSize;
        G1Point qm;
        G1Point qc;
        G1Point ql;
        G1Point qr;
        G1Point qo;
        G1Point q4;
        G1Point qLookup;
        G1Point qArith;
        G1Point qDeltaRange;
        G1Point qMemory;
        G1Point qNnf;
        G1Point qElliptic;
        G1Point qPoseidon2External;
        G1Point qPoseidon2Internal;
        G1Point s1;
        G1Point s2;
        G1Point s3;
        G1Point s4;
        G1Point id1;
        G1Point id2;
        G1Point id3;
        G1Point id4;
        G1Point t1;
        G1Point t2;
        G1Point t3;
        G1Point t4;
        G1Point lagrangeFirst;
        G1Point lagrangeLast;
    }

    struct RelationParameters {
        Fr eta;
        Fr etaTwo;
        Fr etaThree;
        Fr beta;
        Fr gamma;
        Fr publicInputsDelta;
    }

    struct Proof {
        Fr[PAIRING_POINTS_SIZE] pairingPointObject;
        G1Point w1;
        G1Point w2;
        G1Point w3;
        G1Point w4;
        G1Point zPerm;
        G1Point lookupReadCounts;
        G1Point lookupReadTags;
        G1Point lookupInverses;
        Fr[BATCHED_RELATION_PARTIAL_LENGTH][CONST_PROOF_SIZE_LOG_N] sumcheckUnivariates;
        Fr[NUMBER_OF_ENTITIES] sumcheckEvaluations;
        G1Point[CONST_PROOF_SIZE_LOG_N - 1] geminiFoldComms;
        Fr[CONST_PROOF_SIZE_LOG_N] geminiAEvaluations;
        G1Point shplonkQ;
        G1Point kzgQuotient;
    }

    struct ZKProof {
        Fr[PAIRING_POINTS_SIZE] pairingPointObject;
        G1Point w1;
        G1Point w2;
        G1Point w3;
        G1Point w4;
        G1Point lookupReadCounts;
        G1Point lookupReadTags;
        G1Point lookupInverses;
        G1Point zPerm;
        G1Point[3] libraCommitments;
        Fr libraSum;
        Fr[ZK_BATCHED_RELATION_PARTIAL_LENGTH][CONST_PROOF_SIZE_LOG_N] sumcheckUnivariates;
        Fr[NUMBER_OF_ENTITIES] sumcheckEvaluations;
        Fr libraEvaluation;
        G1Point geminiMaskingPoly;
        Fr geminiMaskingEval;
        G1Point[CONST_PROOF_SIZE_LOG_N - 1] geminiFoldComms;
        Fr[CONST_PROOF_SIZE_LOG_N] geminiAEvaluations;
        Fr[4] libraPolyEvals;
        G1Point shplonkQ;
        G1Point kzgQuotient;
    }
}

struct ZKTranscript {
    Honk.RelationParameters relationParameters;
    Fr[NUMBER_OF_ALPHAS] alphas;
    Fr[CONST_PROOF_SIZE_LOG_N] gateChallenges;
    Fr libraChallenge;
    Fr[CONST_PROOF_SIZE_LOG_N] sumCheckUChallenges;
    Fr rho;
    Fr geminiR;
    Fr shplonkNu;
    Fr shplonkZ;
    Fr publicInputsDelta;
}

interface IVerifier {
    function verify(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external returns (bool);
}

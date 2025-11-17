// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "./FrLib.sol";
import "./HonkTypes.sol";
import "./ZKTranscriptLib.sol";
import "./RelationsLib.sol";
import "./CommitmentSchemeLib.sol";
import "./ECOperations.sol";

abstract contract BaseZKHonkVerifier is IVerifier {
    using FrLib for Fr;

    uint256 immutable $N;
    uint256 immutable $LOG_N;
    uint256 immutable $VK_HASH;
    uint256 immutable $NUM_PUBLIC_INPUTS;

    constructor(
        uint256 _N,
        uint256 _logN,
        uint256 _vkHash,
        uint256 _numPublicInputs
    ) {
        $N = _N;
        $LOG_N = _logN;
        $VK_HASH = _vkHash;
        $NUM_PUBLIC_INPUTS = _numPublicInputs;
    }

    error ProofLengthWrong();
    error ProofLengthWrongWithLogN(
        uint256 logN,
        uint256 actualLength,
        uint256 expectedLength
    );
    error PublicInputsLengthWrong();
    error SumcheckFailed();
    error ShpleminiFailed();
    error GeminiChallengeInSubgroup();
    error ConsistencyCheckFailed();

    uint256 constant NUM_WITNESS_ENTITIES = 8;
    uint256 constant NUM_ELEMENTS_COMM = 2;
    uint256 constant NUM_ELEMENTS_FR = 1;
    uint256 constant NUM_LIBRA_EVALUATIONS = 4;
    uint256 constant SHIFTED_COMMITMENTS_START = 30;
    uint256 constant PERMUTATION_ARGUMENT_VALUE_SEPARATOR = 1 << 28;
    uint256 constant LIBRA_COMMITMENTS = 3;
    uint256 constant LIBRA_UNIVARIATES_LENGTH = 9;

    function calculateProofSize(uint256 logN) internal pure returns (uint256) {
        uint256 proofLength = NUM_WITNESS_ENTITIES * NUM_ELEMENTS_COMM;
        proofLength += NUM_ELEMENTS_COMM * 4;
        proofLength +=
            logN *
            ZK_BATCHED_RELATION_PARTIAL_LENGTH *
            NUM_ELEMENTS_FR;
        proofLength += NUMBER_OF_ENTITIES * NUM_ELEMENTS_FR;
        proofLength += NUM_ELEMENTS_FR * 3;
        proofLength += logN * NUM_ELEMENTS_FR;
        proofLength += NUM_LIBRA_EVALUATIONS * NUM_ELEMENTS_FR;
        proofLength += (logN - 1) * NUM_ELEMENTS_COMM;
        proofLength += NUM_ELEMENTS_COMM * 2;
        proofLength += PAIRING_POINTS_SIZE;

        return proofLength;
    }

    function loadVerificationKey()
        internal
        pure
        virtual
        returns (Honk.VerificationKey memory);

    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) public view override returns (bool verified) {
        uint256 expectedProofSize = calculateProofSize($LOG_N);

        if (proof.length != expectedProofSize * 32) {
            revert ProofLengthWrongWithLogN(
                $LOG_N,
                proof.length,
                expectedProofSize * 32
            );
        }

        Honk.VerificationKey memory vk = loadVerificationKey();
        Honk.ZKProof memory p = ZKTranscriptLib.loadProof(proof, $LOG_N);

        if (publicInputs.length != vk.publicInputsSize - PAIRING_POINTS_SIZE) {
            revert PublicInputsLengthWrong();
        }

        ZKTranscript memory t = ZKTranscriptLib.generateTranscript(
            p,
            publicInputs,
            $VK_HASH,
            $NUM_PUBLIC_INPUTS,
            $LOG_N
        );

        t.relationParameters.publicInputsDelta = computePublicInputDelta(
            publicInputs,
            p.pairingPointObject,
            t.relationParameters.beta,
            t.relationParameters.gamma,
            1
        );

        if (!verifySumcheck(p, t)) revert SumcheckFailed();

        if (!verifyShplemini(p, vk, t)) revert ShpleminiFailed();

        verified = true;
    }

    function computePublicInputDelta(
        bytes32[] memory publicInputs,
        Fr[PAIRING_POINTS_SIZE] memory pairingPointObject,
        Fr beta,
        Fr gamma,
        uint256 offset
    ) internal view returns (Fr publicInputDelta) {
        Fr numerator = Fr.wrap(1);
        Fr denominator = Fr.wrap(1);

        Fr numeratorAcc = gamma +
            (beta * FrLib.from(PERMUTATION_ARGUMENT_VALUE_SEPARATOR + offset));
        Fr denominatorAcc = gamma - (beta * FrLib.from(offset + 1));

        {
            for (
                uint256 i = 0;
                i < $NUM_PUBLIC_INPUTS - PAIRING_POINTS_SIZE;
                i++
            ) {
                Fr pubInput = FrLib.fromBytes32(publicInputs[i]);

                numerator = numerator * (numeratorAcc + pubInput);
                denominator = denominator * (denominatorAcc + pubInput);

                numeratorAcc = numeratorAcc + beta;
                denominatorAcc = denominatorAcc - beta;
            }

            for (uint256 i = 0; i < PAIRING_POINTS_SIZE; i++) {
                Fr pubInput = pairingPointObject[i];

                numerator = numerator * (numeratorAcc + pubInput);
                denominator = denominator * (denominatorAcc + pubInput);

                numeratorAcc = numeratorAcc + beta;
                denominatorAcc = denominatorAcc - beta;
            }
        }

        publicInputDelta = FrLib.div(numerator, denominator);
    }

    function verifySumcheck(
        Honk.ZKProof memory proof,
        ZKTranscript memory tp
    ) internal view returns (bool verified) {
        Fr roundTargetSum = tp.libraChallenge * proof.libraSum;
        Fr powPartialEvaluation = Fr.wrap(1);

        for (uint256 round; round < $LOG_N; ++round) {
            Fr[ZK_BATCHED_RELATION_PARTIAL_LENGTH]
                memory roundUnivariate = proof.sumcheckUnivariates[round];
            Fr totalSum = roundUnivariate[0] + roundUnivariate[1];
            if (totalSum != roundTargetSum) revert SumcheckFailed();

            Fr roundChallenge = tp.sumCheckUChallenges[round];

            roundTargetSum = computeNextTargetSum(
                roundUnivariate,
                roundChallenge
            );
            powPartialEvaluation =
                powPartialEvaluation *
                (Fr.wrap(1) +
                    roundChallenge *
                    (tp.gateChallenges[round] - Fr.wrap(1)));
        }

        Fr grandHonkRelationSum = RelationsLib.accumulateRelationEvaluations(
            proof.sumcheckEvaluations,
            tp.relationParameters,
            tp.alphas,
            powPartialEvaluation
        );

        Fr evaluation = Fr.wrap(1);
        for (uint256 i = 2; i < $LOG_N; i++) {
            evaluation = evaluation * tp.sumCheckUChallenges[i];
        }

        grandHonkRelationSum =
            grandHonkRelationSum *
            (Fr.wrap(1) - evaluation) +
            proof.libraEvaluation *
            tp.libraChallenge;
        verified = (grandHonkRelationSum == roundTargetSum);
    }

    function computeNextTargetSum(
        Fr[ZK_BATCHED_RELATION_PARTIAL_LENGTH] memory roundUnivariates,
        Fr roundChallenge
    ) internal view returns (Fr targetSum) {
        Fr[ZK_BATCHED_RELATION_PARTIAL_LENGTH]
            memory BARYCENTRIC_LAGRANGE_DENOMINATORS = [
                Fr.wrap(
                    0x0000000000000000000000000000000000000000000000000000000000009d80
                ),
                Fr.wrap(
                    0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593efffec51
                ),
                Fr.wrap(
                    0x00000000000000000000000000000000000000000000000000000000000005a0
                ),
                Fr.wrap(
                    0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593effffd31
                ),
                Fr.wrap(
                    0x0000000000000000000000000000000000000000000000000000000000000240
                ),
                Fr.wrap(
                    0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593effffd31
                ),
                Fr.wrap(
                    0x00000000000000000000000000000000000000000000000000000000000005a0
                ),
                Fr.wrap(
                    0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593efffec51
                ),
                Fr.wrap(
                    0x0000000000000000000000000000000000000000000000000000000000009d80
                )
            ];

        Fr numeratorValue = Fr.wrap(1);
        for (uint256 i = 0; i < ZK_BATCHED_RELATION_PARTIAL_LENGTH; ++i) {
            numeratorValue = numeratorValue * (roundChallenge - Fr.wrap(i));
        }

        Fr[ZK_BATCHED_RELATION_PARTIAL_LENGTH] memory denominatorInverses;
        for (uint256 i = 0; i < ZK_BATCHED_RELATION_PARTIAL_LENGTH; ++i) {
            denominatorInverses[i] = FrLib.invert(
                BARYCENTRIC_LAGRANGE_DENOMINATORS[i] *
                    (roundChallenge - Fr.wrap(i))
            );
        }

        for (uint256 i = 0; i < ZK_BATCHED_RELATION_PARTIAL_LENGTH; ++i) {
            targetSum =
                targetSum +
                roundUnivariates[i] *
                denominatorInverses[i];
        }

        targetSum = targetSum * numeratorValue;
    }

    struct PairingInputs {
        Honk.G1Point P_0;
        Honk.G1Point P_1;
    }

    function verifyShplemini(
        Honk.ZKProof memory proof,
        Honk.VerificationKey memory vk,
        ZKTranscript memory tp
    ) internal view returns (bool verified) {
        CommitmentSchemeLib.ShpleminiIntermediates memory mem;

        Fr[] memory powers_of_evaluation_challenge = CommitmentSchemeLib
            .computeSquares(tp.geminiR, $LOG_N);
        Fr[] memory scalars = new Fr[](
            NUMBER_UNSHIFTED + $LOG_N + LIBRA_COMMITMENTS + 3
        );
        Honk.G1Point[] memory commitments = new Honk.G1Point[](
            NUMBER_UNSHIFTED + $LOG_N + LIBRA_COMMITMENTS + 3
        );

        mem.posInvertedDenominator = (tp.shplonkZ -
            powers_of_evaluation_challenge[0]).invert();
        mem.negInvertedDenominator = (tp.shplonkZ +
            powers_of_evaluation_challenge[0]).invert();

        mem.unshiftedScalar =
            mem.posInvertedDenominator +
            (tp.shplonkNu * mem.negInvertedDenominator);
        mem.shiftedScalar =
            tp.geminiR.invert() *
            (mem.posInvertedDenominator -
                (tp.shplonkNu * mem.negInvertedDenominator));

        scalars[0] = Fr.wrap(1);
        commitments[0] = proof.shplonkQ;

        mem.batchedEvaluation = proof.geminiMaskingEval;
        mem.batchingChallenge = tp.rho;
        mem.unshiftedScalarNeg = mem.unshiftedScalar.neg();
        mem.shiftedScalarNeg = mem.shiftedScalar.neg();

        scalars[1] = mem.unshiftedScalarNeg;
        for (uint256 i = 0; i < NUMBER_UNSHIFTED; ++i) {
            scalars[i + 2] = mem.unshiftedScalarNeg * mem.batchingChallenge;
            mem.batchedEvaluation =
                mem.batchedEvaluation +
                (proof.sumcheckEvaluations[i] * mem.batchingChallenge);
            mem.batchingChallenge = mem.batchingChallenge * tp.rho;
        }

        for (uint256 i = 0; i < NUMBER_TO_BE_SHIFTED; ++i) {
            uint256 scalarOff = i + SHIFTED_COMMITMENTS_START;
            uint256 evaluationOff = i + NUMBER_UNSHIFTED;

            scalars[scalarOff] =
                scalars[scalarOff] +
                (mem.shiftedScalarNeg * mem.batchingChallenge);
            mem.batchedEvaluation =
                mem.batchedEvaluation +
                (proof.sumcheckEvaluations[evaluationOff] *
                    mem.batchingChallenge);
            mem.batchingChallenge = mem.batchingChallenge * tp.rho;
        }

        commitments[1] = proof.geminiMaskingPoly;

        commitments[2] = vk.qm;
        commitments[3] = vk.qc;
        commitments[4] = vk.ql;
        commitments[5] = vk.qr;
        commitments[6] = vk.qo;
        commitments[7] = vk.q4;
        commitments[8] = vk.qLookup;
        commitments[9] = vk.qArith;
        commitments[10] = vk.qDeltaRange;
        commitments[11] = vk.qElliptic;
        commitments[12] = vk.qMemory;
        commitments[13] = vk.qNnf;
        commitments[14] = vk.qPoseidon2External;
        commitments[15] = vk.qPoseidon2Internal;
        commitments[16] = vk.s1;
        commitments[17] = vk.s2;
        commitments[18] = vk.s3;
        commitments[19] = vk.s4;
        commitments[20] = vk.id1;
        commitments[21] = vk.id2;
        commitments[22] = vk.id3;
        commitments[23] = vk.id4;
        commitments[24] = vk.t1;
        commitments[25] = vk.t2;
        commitments[26] = vk.t3;
        commitments[27] = vk.t4;
        commitments[28] = vk.lagrangeFirst;
        commitments[29] = vk.lagrangeLast;

        commitments[30] = proof.w1;
        commitments[31] = proof.w2;
        commitments[32] = proof.w3;
        commitments[33] = proof.w4;
        commitments[34] = proof.zPerm;
        commitments[35] = proof.lookupInverses;
        commitments[36] = proof.lookupReadCounts;
        commitments[37] = proof.lookupReadTags;

        Fr[] memory foldPosEvaluations = CommitmentSchemeLib
            .computeFoldPosEvaluations(
                tp.sumCheckUChallenges,
                mem.batchedEvaluation,
                proof.geminiAEvaluations,
                powers_of_evaluation_challenge,
                $LOG_N
            );

        mem.constantTermAccumulator =
            foldPosEvaluations[0] *
            mem.posInvertedDenominator;
        mem.constantTermAccumulator =
            mem.constantTermAccumulator +
            (proof.geminiAEvaluations[0] *
                tp.shplonkNu *
                mem.negInvertedDenominator);

        mem.batchingChallenge = tp.shplonkNu.sqr();
        uint256 boundary = NUMBER_UNSHIFTED + 2;

        for (uint256 i = 0; i < $LOG_N - 1; ++i) {
            bool dummy_round = i >= ($LOG_N - 1);

            if (!dummy_round) {
                mem.posInvertedDenominator = (tp.shplonkZ -
                    powers_of_evaluation_challenge[i + 1]).invert();
                mem.negInvertedDenominator = (tp.shplonkZ +
                    powers_of_evaluation_challenge[i + 1]).invert();

                mem.scalingFactorPos =
                    mem.batchingChallenge *
                    mem.posInvertedDenominator;
                mem.scalingFactorNeg =
                    mem.batchingChallenge *
                    tp.shplonkNu *
                    mem.negInvertedDenominator;
                scalars[boundary + i] =
                    mem.scalingFactorNeg.neg() +
                    mem.scalingFactorPos.neg();

                Fr accumContribution = mem.scalingFactorNeg *
                    proof.geminiAEvaluations[i + 1];
                accumContribution =
                    accumContribution +
                    mem.scalingFactorPos *
                    foldPosEvaluations[i + 1];
                mem.constantTermAccumulator =
                    mem.constantTermAccumulator +
                    accumContribution;
            }
            mem.batchingChallenge =
                mem.batchingChallenge *
                tp.shplonkNu *
                tp.shplonkNu;

            commitments[boundary + i] = proof.geminiFoldComms[i];
        }

        boundary += $LOG_N - 1;

        mem.denominators[0] = Fr.wrap(1).div(tp.shplonkZ - tp.geminiR);
        mem.denominators[1] = Fr.wrap(1).div(
            tp.shplonkZ - SUBGROUP_GENERATOR * tp.geminiR
        );
        mem.denominators[2] = mem.denominators[0];
        mem.denominators[3] = mem.denominators[0];

        mem.batchingChallenge =
            mem.batchingChallenge *
            tp.shplonkNu *
            tp.shplonkNu;
        for (uint256 i = 0; i < NUM_LIBRA_EVALUATIONS; i++) {
            Fr scalingFactor = mem.denominators[i] * mem.batchingChallenge;
            mem.batchingScalars[i] = scalingFactor.neg();
            mem.batchingChallenge = mem.batchingChallenge * tp.shplonkNu;
            mem.constantTermAccumulator =
                mem.constantTermAccumulator +
                scalingFactor *
                proof.libraPolyEvals[i];
        }
        scalars[boundary] = mem.batchingScalars[0];
        scalars[boundary + 1] = mem.batchingScalars[1] + mem.batchingScalars[2];
        scalars[boundary + 2] = mem.batchingScalars[3];

        for (uint256 i = 0; i < LIBRA_COMMITMENTS; i++) {
            commitments[boundary++] = proof.libraCommitments[i];
        }

        commitments[boundary] = Honk.G1Point({x: 1, y: 2});
        scalars[boundary++] = mem.constantTermAccumulator;

        if (
            !checkEvalsConsistency(
                proof.libraPolyEvals,
                tp.geminiR,
                tp.sumCheckUChallenges,
                proof.libraEvaluation
            )
        ) {
            revert ConsistencyCheckFailed();
        }

        Honk.G1Point memory quotient_commitment = proof.kzgQuotient;

        commitments[boundary] = quotient_commitment;
        scalars[boundary] = tp.shplonkZ;

        PairingInputs memory pair;
        pair.P_0 = batchMul(commitments, scalars);
        pair.P_1 = negateInplace(quotient_commitment);

        Fr recursionSeparator = generateRecursionSeparator(
            proof.pairingPointObject,
            pair.P_0,
            pair.P_1
        );
        (
            Honk.G1Point memory P_0_other,
            Honk.G1Point memory P_1_other
        ) = convertPairingPointsToG1(proof.pairingPointObject);

        validateOnCurve(P_0_other);
        validateOnCurve(P_1_other);

        pair.P_0 = mulWithSeperator(pair.P_0, P_0_other, recursionSeparator);
        pair.P_1 = mulWithSeperator(pair.P_1, P_1_other, recursionSeparator);

        return pairing(pair.P_0, pair.P_1);
    }

    struct SmallSubgroupIpaIntermediates {
        Fr[SUBGROUP_SIZE] challengePolyLagrange;
        Fr challengePolyEval;
        Fr lagrangeFirst;
        Fr lagrangeLast;
        Fr rootPower;
        Fr[SUBGROUP_SIZE] denominators;
        Fr diff;
    }

    function checkEvalsConsistency(
        Fr[NUM_LIBRA_EVALUATIONS] memory libraPolyEvals,
        Fr geminiR,
        Fr[CONST_PROOF_SIZE_LOG_N] memory uChallenges,
        Fr libraEval
    ) internal view returns (bool check) {
        Fr one = Fr.wrap(1);
        Fr vanishingPolyEval = geminiR.pow(SUBGROUP_SIZE) - one;
        if (vanishingPolyEval == Fr.wrap(0)) {
            revert GeminiChallengeInSubgroup();
        }

        SmallSubgroupIpaIntermediates memory mem;
        mem.challengePolyLagrange[0] = one;
        for (uint256 round = 0; round < $LOG_N; round++) {
            uint256 currIdx = 1 + LIBRA_UNIVARIATES_LENGTH * round;
            mem.challengePolyLagrange[currIdx] = one;
            for (
                uint256 idx = currIdx + 1;
                idx < currIdx + LIBRA_UNIVARIATES_LENGTH;
                idx++
            ) {
                mem.challengePolyLagrange[idx] =
                    mem.challengePolyLagrange[idx - 1] *
                    uChallenges[round];
            }
        }

        mem.rootPower = one;
        mem.challengePolyEval = Fr.wrap(0);
        for (uint256 idx = 0; idx < SUBGROUP_SIZE; idx++) {
            mem.denominators[idx] = mem.rootPower * geminiR - one;
            mem.denominators[idx] = mem.denominators[idx].invert();
            mem.challengePolyEval =
                mem.challengePolyEval +
                mem.challengePolyLagrange[idx] *
                mem.denominators[idx];
            mem.rootPower = mem.rootPower * SUBGROUP_GENERATOR_INVERSE;
        }

        Fr numerator = vanishingPolyEval * Fr.wrap(SUBGROUP_SIZE).invert();
        mem.challengePolyEval = mem.challengePolyEval * numerator;
        mem.lagrangeFirst = mem.denominators[0] * numerator;
        mem.lagrangeLast = mem.denominators[SUBGROUP_SIZE - 1] * numerator;

        mem.diff = mem.lagrangeFirst * libraPolyEvals[2];

        mem.diff =
            mem.diff +
            (geminiR - SUBGROUP_GENERATOR_INVERSE) *
            (libraPolyEvals[1] -
                libraPolyEvals[2] -
                libraPolyEvals[0] *
                mem.challengePolyEval);
        mem.diff =
            mem.diff +
            mem.lagrangeLast *
            (libraPolyEvals[2] - libraEval) -
            vanishingPolyEval *
            libraPolyEvals[3];

        check = mem.diff == Fr.wrap(0);
    }

    function batchMul(
        Honk.G1Point[] memory base,
        Fr[] memory scalars
    ) internal view returns (Honk.G1Point memory result) {
        uint256 limit = NUMBER_UNSHIFTED + $LOG_N + LIBRA_COMMITMENTS + 3;

        for (uint256 i = 0; i < limit; ++i) {
            validateOnCurve(base[i]);
        }

        bool success = true;
        assembly {
            let free := mload(0x40)

            let count := 0x01
            for {

            } lt(count, add(limit, 1)) {
                count := add(count, 1)
            } {
                let base_base := add(base, mul(count, 0x20))
                let scalar_base := add(scalars, mul(count, 0x20))

                mstore(add(free, 0x40), mload(mload(base_base)))
                mstore(add(free, 0x60), mload(add(0x20, mload(base_base))))
                mstore(add(free, 0x80), mload(scalar_base))

                success := and(
                    success,
                    staticcall(
                        gas(),
                        7,
                        add(free, 0x40),
                        0x60,
                        add(free, 0x40),
                        0x40
                    )
                )
                success := and(
                    success,
                    staticcall(gas(), 6, free, 0x80, free, 0x40)
                )
            }

            mstore(result, mload(free))
            mstore(add(result, 0x20), mload(add(free, 0x20)))
        }

        require(success, ShpleminiFailed());
    }
}

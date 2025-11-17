// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "./FrLib.sol";
import "./HonkTypes.sol";

library CommitmentSchemeLib {
    using FrLib for Fr;

    struct ShpleminiIntermediates {
        Fr unshiftedScalar;
        Fr shiftedScalar;
        Fr unshiftedScalarNeg;
        Fr shiftedScalarNeg;
        Fr constantTermAccumulator;
        Fr batchingChallenge;
        Fr batchedEvaluation;
        Fr[4] denominators;
        Fr[4] batchingScalars;
        Fr posInvertedDenominator;
        Fr negInvertedDenominator;
        Fr scalingFactorPos;
        Fr scalingFactorNeg;
        Fr[] foldPosEvaluations;
    }

    function computeSquares(
        Fr r,
        uint256 logN
    ) internal pure returns (Fr[] memory) {
        Fr[] memory squares = new Fr[](logN);
        squares[0] = r;
        for (uint256 i = 1; i < logN; ++i) {
            squares[i] = squares[i - 1].sqr();
        }
        return squares;
    }

    function computeFoldPosEvaluations(
        Fr[CONST_PROOF_SIZE_LOG_N] memory sumcheckUChallenges,
        Fr batchedEvalAccumulator,
        Fr[CONST_PROOF_SIZE_LOG_N] memory geminiEvaluations,
        Fr[] memory geminiEvalChallengePowers,
        uint256 logSize
    ) internal view returns (Fr[] memory) {
        Fr[] memory foldPosEvaluations = new Fr[](logSize);
        for (uint256 i = logSize; i > 0; --i) {
            Fr challengePower = geminiEvalChallengePowers[i - 1];
            Fr u = sumcheckUChallenges[i - 1];

            Fr batchedEvalRoundAcc = ((challengePower *
                batchedEvalAccumulator *
                Fr.wrap(2)) -
                geminiEvaluations[i - 1] *
                (challengePower * (ONE - u) - u));
            batchedEvalRoundAcc =
                batchedEvalRoundAcc *
                (challengePower * (ONE - u) + u).invert();

            batchedEvalAccumulator = batchedEvalRoundAcc;
            foldPosEvaluations[i - 1] = batchedEvalRoundAcc;
        }
        return foldPosEvaluations;
    }
}

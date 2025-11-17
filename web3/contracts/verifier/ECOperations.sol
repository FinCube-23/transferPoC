// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "./FrLib.sol";
import "./HonkTypes.sol";

uint256 constant Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

function bytesToFr(bytes calldata proofSection) pure returns (Fr scalar) {
    scalar = FrLib.fromBytes32(bytes32(proofSection));
}

function bytesToG1Point(
    bytes calldata proofSection
) pure returns (Honk.G1Point memory point) {
    point = Honk.G1Point({
        x: uint256(bytes32(proofSection[0x00:0x20])) % Q,
        y: uint256(bytes32(proofSection[0x20:0x40])) % Q
    });
}

function negateInplace(
    Honk.G1Point memory point
) pure returns (Honk.G1Point memory) {
    point.y = (Q - point.y) % Q;
    return point;
}

function convertPairingPointsToG1(
    Fr[PAIRING_POINTS_SIZE] memory pairingPoints
) pure returns (Honk.G1Point memory lhs, Honk.G1Point memory rhs) {
    uint256 lhsX = Fr.unwrap(pairingPoints[0]);
    lhsX |= Fr.unwrap(pairingPoints[1]) << 68;
    lhsX |= Fr.unwrap(pairingPoints[2]) << 136;
    lhsX |= Fr.unwrap(pairingPoints[3]) << 204;
    lhs.x = lhsX;

    uint256 lhsY = Fr.unwrap(pairingPoints[4]);
    lhsY |= Fr.unwrap(pairingPoints[5]) << 68;
    lhsY |= Fr.unwrap(pairingPoints[6]) << 136;
    lhsY |= Fr.unwrap(pairingPoints[7]) << 204;
    lhs.y = lhsY;

    uint256 rhsX = Fr.unwrap(pairingPoints[8]);
    rhsX |= Fr.unwrap(pairingPoints[9]) << 68;
    rhsX |= Fr.unwrap(pairingPoints[10]) << 136;
    rhsX |= Fr.unwrap(pairingPoints[11]) << 204;
    rhs.x = rhsX;

    uint256 rhsY = Fr.unwrap(pairingPoints[12]);
    rhsY |= Fr.unwrap(pairingPoints[13]) << 68;
    rhsY |= Fr.unwrap(pairingPoints[14]) << 136;
    rhsY |= Fr.unwrap(pairingPoints[15]) << 204;
    rhs.y = rhsY;
}

function generateRecursionSeparator(
    Fr[PAIRING_POINTS_SIZE] memory proofPairingPoints,
    Honk.G1Point memory accLhs,
    Honk.G1Point memory accRhs
) pure returns (Fr recursionSeparator) {
    (
        Honk.G1Point memory proofLhs,
        Honk.G1Point memory proofRhs
    ) = convertPairingPointsToG1(proofPairingPoints);

    uint256[8] memory recursionSeparatorElements;
    recursionSeparatorElements[0] = proofLhs.x;
    recursionSeparatorElements[1] = proofLhs.y;
    recursionSeparatorElements[2] = proofRhs.x;
    recursionSeparatorElements[3] = proofRhs.y;
    recursionSeparatorElements[4] = accLhs.x;
    recursionSeparatorElements[5] = accLhs.y;
    recursionSeparatorElements[6] = accRhs.x;
    recursionSeparatorElements[7] = accRhs.y;

    recursionSeparator = FrLib.fromBytes32(
        keccak256(abi.encodePacked(recursionSeparatorElements))
    );
}

function mulWithSeperator(
    Honk.G1Point memory basePoint,
    Honk.G1Point memory other,
    Fr recursionSeperator
) view returns (Honk.G1Point memory) {
    Honk.G1Point memory result;
    result = ecMul(recursionSeperator, basePoint);
    result = ecAdd(result, other);
    return result;
}

function ecMul(
    Fr value,
    Honk.G1Point memory point
) view returns (Honk.G1Point memory) {
    Honk.G1Point memory result;

    assembly {
        let free := mload(0x40)
        mstore(free, mload(point))
        mstore(add(free, 0x20), mload(add(point, 0x20)))
        mstore(add(free, 0x40), value)

        let success := staticcall(gas(), 0x07, free, 0x60, free, 0x40)
        if iszero(success) {
            revert(0, 0)
        }
        mstore(result, mload(free))
        mstore(add(result, 0x20), mload(add(free, 0x20)))
        mstore(0x40, add(free, 0x60))
    }

    return result;
}

function ecAdd(
    Honk.G1Point memory lhs,
    Honk.G1Point memory rhs
) view returns (Honk.G1Point memory) {
    Honk.G1Point memory result;

    assembly {
        let free := mload(0x40)
        mstore(free, mload(lhs))
        mstore(add(free, 0x20), mload(add(lhs, 0x20)))
        mstore(add(free, 0x40), mload(rhs))
        mstore(add(free, 0x60), mload(add(rhs, 0x20)))

        let success := staticcall(gas(), 0x06, free, 0x80, free, 0x40)
        if iszero(success) {
            revert(0, 0)
        }

        mstore(result, mload(free))
        mstore(add(result, 0x20), mload(add(free, 0x20)))
        mstore(0x40, add(free, 0x80))
    }

    return result;
}

function validateOnCurve(Honk.G1Point memory point) pure {
    uint256 x = point.x;
    uint256 y = point.y;

    bool success = false;
    assembly {
        let xx := mulmod(x, x, Q)
        success := eq(mulmod(y, y, Q), addmod(mulmod(x, xx, Q), 3, Q))
    }

    require(success, "point is not on the curve");
}

function pairing(
    Honk.G1Point memory rhs,
    Honk.G1Point memory lhs
) view returns (bool decodedResult) {
    bytes memory input = abi.encodePacked(
        rhs.x,
        rhs.y,
        uint256(
            0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2
        ),
        uint256(
            0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed
        ),
        uint256(
            0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b
        ),
        uint256(
            0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa
        ),
        lhs.x,
        lhs.y,
        uint256(
            0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1
        ),
        uint256(
            0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0
        ),
        uint256(
            0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4
        ),
        uint256(
            0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55
        )
    );

    (bool success, bytes memory result) = address(0x08).staticcall(input);
    decodedResult = success && abi.decode(result, (bool));
}

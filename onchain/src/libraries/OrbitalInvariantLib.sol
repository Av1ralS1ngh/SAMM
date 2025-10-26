// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/OrbitalMath.sol";

/**
 * @title OrbitalInvariantLib
 * @notice Pure math & binary search routines for OrbitalPool extracted to reduce stack pressure
 */
library OrbitalInvariantLib {
    /**
     * @notice Build equal price vector e = (1,1,...,1)/sqrt(n)
     */
    function getEqualPriceVector(uint256 tokenCount) internal pure returns (uint256[] memory e) {
        e = new uint256[](tokenCount);
        uint256 component = OrbitalMath.PRECISION / OrbitalMath.sqrt(tokenCount * OrbitalMath.PRECISION);
        for (uint256 i = 0; i < tokenCount; i++) {
            e[i] = component;
        }
    }

    /**
     * @notice Compute torus invariant with provided global state aggregates
     */
    function computeTorusInvariant(
        uint256[] memory reserves,
        uint256 tokenCount,
        uint256 totalInteriorRadiusSquared,
        uint256 totalBoundaryRadiusSquared,
        uint256 totalBoundaryConstantSquared
    ) internal pure returns (uint256) {
        uint256 sumSquares = 0;
        for (uint256 i = 0; i < reserves.length; i++) {
            sumSquares += reserves[i] * reserves[i];
        }
        uint256[] memory e = getEqualPriceVector(tokenCount);
        uint256 projection = 0;
        for (uint256 i = 0; i < reserves.length; i++) {
            projection += (reserves[i] * e[i]) / OrbitalMath.PRECISION;
        }
        uint256 projectionSquared = (projection * projection) / OrbitalMath.PRECISION;
        uint256 radiusSum = totalInteriorRadiusSquared + totalBoundaryRadiusSquared;
        uint256 term1 = sumSquares > radiusSum ? sumSquares - radiusSum : 0;
        uint256 term1Squared = (term1 * term1) / OrbitalMath.PRECISION;
        uint256 term2 = 4 * totalBoundaryRadiusSquared *
            (projectionSquared > totalBoundaryConstantSquared ? projectionSquared - totalBoundaryConstantSquared : 0) /
            OrbitalMath.PRECISION;
        return term1Squared + term2;
    }

    /**
     * @notice Binary search swap output maintaining invariant
     */
    function calculateSwapOutput(
        uint256[] memory reserves,
        uint256 tokenIn,
        uint256 tokenOut,
        uint256 amountIn,
        uint256 tokenCount,
        uint256 totalInteriorRadiusSquared,
        uint256 totalBoundaryRadiusSquared,
        uint256 totalBoundaryConstantSquared
    ) internal pure returns (uint256) {
        uint256 currentInvariant = computeTorusInvariant(
            reserves,
            tokenCount,
            totalInteriorRadiusSquared,
            totalBoundaryRadiusSquared,
            totalBoundaryConstantSquared
        );
        uint256 low = 0;
        uint256 high = reserves[tokenOut];
        uint256 mid;
        for (uint256 i = 0; i < 128; i++) {
            mid = (low + high) / 2;
            uint256[] memory newReserves = new uint256[](reserves.length);
            for (uint256 j = 0; j < reserves.length; j++) {
                newReserves[j] = reserves[j];
            }
            newReserves[tokenIn] += amountIn;
            newReserves[tokenOut] -= mid;
            uint256 newInvariant = computeTorusInvariant(
                newReserves,
                tokenCount,
                totalInteriorRadiusSquared,
                totalBoundaryRadiusSquared,
                totalBoundaryConstantSquared
            );
            if (newInvariant > currentInvariant) {
                high = mid;
            } else {
                low = mid;
            }
            if (high - low <= 1) break;
        }
        return low;
    }
}

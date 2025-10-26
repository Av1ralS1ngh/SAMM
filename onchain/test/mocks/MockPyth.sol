// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPyth} from "../../src/StablecoinPriceOracle.sol";

contract MockPyth is IPyth {
    mapping(bytes32 => Price) public prices;
    uint256 public lastFeeQuoted;
    uint256 public feePerUpdate = 0.001 ether;

    function setPrice(bytes32 id, int64 price, int32 expo, uint64 publishTime, uint64 conf) external {
        prices[id] = Price({price: price, conf: conf, expo: expo, publishTime: publishTime});
    }

    function updatePriceFeeds(bytes[] calldata) external payable override {
        lastFeeQuoted = msg.value; // accept fee, no-op on data
    }

    function getUpdateFee(bytes[] calldata updateData) external view override returns (uint256) {
        return feePerUpdate * updateData.length;
    }

    function getPriceUnsafe(bytes32 id) external view override returns (Price memory) {
        return prices[id];
    }
}

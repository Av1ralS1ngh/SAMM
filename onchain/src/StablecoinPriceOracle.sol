// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StablecoinPriceOracle
 * @notice Pull-based Pyth price integration for stablecoins (USDC, USDT, DAI, PYUSD)
 * @dev Minimal implementation suitable for hackathon: stores last price & update time
 *      Integrates with Pyth pull model: backend fetches update data from Hermes,
 *      then calls updatePrices passing the raw update blobs + feed ids.
 */
interface IPyth {
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);
    struct Price {
        int64 price;      // price * 10^expo
        uint64 conf;      // confidence interval around price
        int32 expo;       // exponent
        uint64 publishTime;
    }
    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
}

contract StablecoinPriceOracle {
    struct StoredPrice {
        uint256 price;       // normalized to 1e8
        uint64 lastUpdate;   // unix time
        uint64 conf;         // confidence (scaled to 1e8 after normalization)
        int32 expo;          // original exponent for reference
    }

    address public owner;
    IPyth public pyth;

    // tokenAddress => pyth price feed id
    mapping(address => bytes32) public feedIds;
    // feed id => stored price
    mapping(bytes32 => StoredPrice) public prices;

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event FeedConfigured(address indexed token, bytes32 indexed feedId);
    event PriceUpdated(bytes32 indexed feedId, uint256 price, uint64 timestamp, uint64 conf);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _pyth) {
        owner = msg.sender;
        pyth = IPyth(_pyth);
    }

    function setOwner(address _owner) external onlyOwner { emit OwnerUpdated(owner, _owner); owner = _owner; }

    function setFeed(address token, bytes32 feedId) external onlyOwner {
        feedIds[token] = feedId;
        emit FeedConfigured(token, feedId);
    }

    /**
     * @notice Update multiple prices using Pyth pull model
     * @param updateData Raw update blobs from Hermes
     * @param feedIdList List of feed ids to store after update
     */
    function updatePrices(bytes[] calldata updateData, bytes32[] calldata feedIdList) external payable {
        // Pay the required fee
        uint256 fee = pyth.getUpdateFee(updateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: fee}(updateData);

        for (uint256 i = 0; i < feedIdList.length; i++) {
            IPyth.Price memory p = pyth.getPriceUnsafe(feedIdList[i]);
            // Normalize to 1e8 (typical stablecoin price scale)
            // p.price * 10^(8 + p.expo) if expo is negative
            int32 expo = p.expo; // e.g., -8 for 1e-8 scaling
            int256 raw = int256(p.price);
            // Target exponent = -8 (1e8 scale). We convert by shifting.
            int32 targetExpo = -8;
            int32 delta = targetExpo - expo; // if expo=-8, delta=0
            if (delta > 0) {
                raw = raw * int256(10 ** uint32(uint32(delta)));
            } else if (delta < 0) {
                raw = raw / int256(10 ** uint32(uint32(-delta)));
            }
            require(raw >= 0, "Negative price");
            uint256 normalized = uint256(raw);

            // confidence normalization similar scaling
            int256 confRaw = int256(uint256(p.conf));
            if (delta > 0) {
                confRaw = confRaw * int256(10 ** uint32(uint32(delta)));
            } else if (delta < 0) {
                confRaw = confRaw / int256(10 ** uint32(uint32(-delta)));
            }
            if (confRaw < 0) confRaw = 0;

            prices[feedIdList[i]] = StoredPrice({
                price: normalized,
                lastUpdate: uint64(p.publishTime),
                conf: uint64(uint256(confRaw)),
                expo: p.expo
            });
            emit PriceUpdated(feedIdList[i], normalized, uint64(p.publishTime), uint64(uint256(confRaw)));
        }

        // refund dust
        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "Refund failed");
        }
    }

    function getPriceByToken(address token) external view returns (StoredPrice memory) {
        bytes32 feedId = feedIds[token];
        require(feedId != bytes32(0), "Feed not set");
        return prices[feedId];
    }

    function getPrice(bytes32 feedId) external view returns (StoredPrice memory) {
        return prices[feedId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IAgentExecutor {
    function evaluateNFT(address nftContract, uint256 nftId) external view returns (uint256);
}

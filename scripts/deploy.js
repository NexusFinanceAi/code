const hre = require("hardhat");

async function main() {
  // Deploy NexusToken
  const NexusToken = await hre.ethers.getContractFactory("NexusToken");
  const nexusToken = await NexusToken.deploy();
  await nexusToken.waitForDeployment();

  console.log("NexusToken deployed to:", await nexusToken.getAddress());

  // Deploy NexusFinance
  const NexusFinance = await hre.ethers.getContractFactory("NexusFinance");
  const nexusFinance = await NexusFinance.deploy(nexusToken.getAddress());
  await nexusFinance.waitForDeployment();
  console.log("NexusFinance deployed to:", await nexusFinance.getAddress());

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

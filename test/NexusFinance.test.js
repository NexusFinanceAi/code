const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NexusFinance", function () {
  let NexusToken;
  let nexusToken;
  let NexusFinance;
  let nexusFinance;
  let owner;
  let borrower;
  let lender;
  let agentExecutor;

  beforeEach(async function () {
    [owner, borrower, lender, agentExecutor] = await ethers.getSigners();

    NexusToken = await ethers.getContractFactory("NexusToken");
    nexusToken = await NexusToken.deploy();
    await nexusToken.waitForDeployment();

    NexusFinance = await ethers.getContractFactory("NexusFinance");
    nexusFinance = await NexusFinance.deploy(nexusToken.getAddress());
    await nexusFinance.waitForDeployment();

    await nexusFinance.setAgentExecutor(agentExecutor.address);
  });

  it("Should create a loan", async function () {
    const MockNFT = await ethers.getContractFactory("MockNFT");
    const mockNFT = await MockNFT.deploy();
    await mockNFT.waitForDeployment();

    await mockNFT.mint(borrower.address, 1);
    await mockNFT.connect(borrower).approve(nexusFinance.getAddress(), 1);

    await nexusFinance.connect(borrower).createLoan(mockNFT.getAddress(), 1, ethers.parseEther("1"), 5, 30);

    const loan = await nexusFinance.loans(1);
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.nftContract).to.equal(mockNFT.getAddress());
    expect(loan.nftId).to.equal(1);
    expect(loan.loanAmount).to.equal(ethers.parseEther("1"));
    expect(loan.interestRate).to.equal(5);
    expect(loan.duration).to.equal(30);
    expect(loan.active).to.equal(false);
  });

  it("Should fund a loan", async function () {
    const MockNFT = await ethers.getContractFactory("MockNFT");
    const mockNFT = await MockNFT.deploy();
    await mockNFT.waitForDeployment();

    await mockNFT.mint(borrower.address, 1);
    await mockNFT.connect(borrower).approve(nexusFinance.getAddress(), 1);
    await nexusFinance.connect(borrower).createLoan(mockNFT.getAddress(), 1, ethers.parseEther("1"), 5, 30);

    // Simulate AgentExecutor returning a valuation
    const MockAgentExecutor = await ethers.getContractFactory("MockAgentExecutor");
    const mockAgentExecutor = await MockAgentExecutor.deploy();
    await mockAgentExecutor.waitForDeployment();
    await nexusFinance.setAgentExecutor(mockAgentExecutor.getAddress());

    await mockAgentExecutor.setValuation(mockNFT.getAddress(), 1, ethers.parseEther("2"));

    await nexusFinance.connect(lender).fundLoan(1, { value: ethers.parseEther("1") });

    const loan = await nexusFinance.loans(1);
    expect(loan.lender).to.equal(lender.address);
    expect(loan.startDate).to.not.equal(0);
    expect(loan.active).to.equal(true);
  });

  it("Should repay a loan", async function () {
    const MockNFT = await ethers.getContractFactory("MockNFT");
    const mockNFT = await MockNFT.deploy();
    await mockNFT.waitForDeployment();

    await mockNFT.mint(borrower.address, 1);
    await mockNFT.connect(borrower).approve(nexusFinance.getAddress(), 1);
    await nexusFinance.connect(borrower).createLoan(mockNFT.getAddress(), 1, ethers.parseEther("1"), 5, 30);

    const MockAgentExecutor = await ethers.getContractFactory("MockAgentExecutor");
    const mockAgentExecutor = await MockAgentExecutor.deploy();
    await mockAgentExecutor.waitForDeployment();
    await nexusFinance.setAgentExecutor(mockAgentExecutor.getAddress());

    await mockAgentExecutor.setValuation(mockNFT.getAddress(), 1, ethers.parseEther("2"));

    await nexusFinance.connect(lender).fundLoan(1, { value: ethers.parseEther("1") });

    // Simulate time passing
    await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]); // 15 days
    await ethers.provider.send("evm_mine");

    await nexusToken.transfer(borrower.address, ethers.parseEther("2")); // Ensure borrower has enough tokens
    await nexusToken.connect(borrower).approve(nexusFinance.getAddress(), ethers.parseEther("2"));

    await nexusFinance.connect(borrower).repayLoan(1);

    const loan = await nexusFinance.loans(1);
    expect(loan.active).to.equal(false);
    expect(await mockNFT.ownerOf(1)).to.equal(borrower.address);
  });

  it("Should liquidate a loan", async function () {
    const MockNFT = await ethers.getContractFactory("MockNFT");
    const mockNFT = await MockNFT.deploy();
    await mockNFT.waitForDeployment();

    await mockNFT.mint(borrower.address, 1);
    await mockNFT.connect(borrower).approve(nexusFinance.getAddress(), 1);
    await nexusFinance.connect(borrower).createLoan(mockNFT.getAddress(), 1, ethers.parseEther("1"), 5, 30);

    const MockAgentExecutor = await ethers.getContractFactory("MockAgentExecutor");
    const mockAgentExecutor = await MockAgentExecutor.deploy();
    await mockAgentExecutor.waitForDeployment();
    await nexusFinance.setAgentExecutor(mockAgentExecutor.getAddress());

    await mockAgentExecutor.setValuation(mockNFT.getAddress(), 1, ethers.parseEther("2"));

    await nexusFinance.connect(lender).fundLoan(1, { value: ethers.parseEther("1") });

    // Simulate time passing beyond loan duration
    await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]); // 31 days
    await ethers.provider.send("evm_mine");

    await nexusFinance.connect(lender).liquidateLoan(1);

    const loan = await nexusFinance.loans(1);
    expect(loan.active).to.equal(false);
    expect(await mockNFT.ownerOf(1)).to.equal(lender.address);
  });
});

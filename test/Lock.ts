import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Upgradeable Counter", function () {
  async function deployContractFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    // Deploy implementation V1
    const CounterV1 = await hre.ethers.getContractFactory("CounterV1");
    const implementationV1 = await CounterV1.deploy();

    // Deploy Proxy
    const Proxy = await hre.ethers.getContractFactory("Proxy");
    const proxy = await Proxy.deploy();

    // Set implementation in proxy
    await proxy.upgradeTo(await implementationV1.getAddress());

    // Create proxy wrapper for easy interaction
    const proxyAsCounter = CounterV1.attach(proxy.target);

    // Deploy V2 (but don't upgrade yet)
    const CounterV2 = await hre.ethers.getContractFactory("CounterV2");
    const implementationV2 = await CounterV2.deploy();

    return { 
      proxy, 
      implementationV1, 
      implementationV2, 
      proxyAsCounter, 
      CounterV1,
      CounterV2,
      owner, 
      otherAccount 
    };
  }

  describe("Proxy", function () {
    it("Should set the right admin", async function () {
      const { proxy, owner } = await loadFixture(deployContractFixture);
      
      // Call admin slot directly since it's private
      const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
      const admin = await hre.ethers.provider.getStorage(proxy.target, adminSlot);
      expect(hre.ethers.getAddress(admin.substring(26))).to.equal(owner.address);
    });

    it("Should set the right implementation", async function () {
      const { proxy, implementationV1 } = await loadFixture(deployContractFixture);
      
      // Call implementation slot directly since it's private
      const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
      const implementation = await hre.ethers.provider.getStorage(proxy.target, implementationSlot);
      expect(hre.ethers.getAddress(implementation.substring(26))).to.equal(await implementationV1.getAddress());
    });
  });

  describe("V1 Functionality", function () {
    it("Should increment counter", async function () {
      const { proxyAsCounter } = await loadFixture(deployContractFixture);
      
      await proxyAsCounter.increment();
      expect(await proxyAsCounter.getCount()).to.equal(1);
    });

    it("Should emit event on increment", async function () {
      const { proxyAsCounter } = await loadFixture(deployContractFixture);
      
      await expect(proxyAsCounter.increment())
        .to.emit(proxyAsCounter, "CountUpdated")
        .withArgs(1);
    });
  });

  describe("Upgrade", function () {
    it("Should upgrade to V2", async function () {
      const { proxy, implementationV2, CounterV2 } = await loadFixture(deployContractFixture);
      
      await proxy.upgradeTo(await implementationV2.getAddress());
      
      // Create new wrapper with V2 ABI
      const proxyAsCounterV2 = CounterV2.attach(proxy.target);
      
      // Test new V2 functionality
      await proxyAsCounterV2.incrementBy(5);
      expect(await proxyAsCounterV2.getCount()).to.equal(5);
    });

    it("Should maintain state after upgrade", async function () {
      const { proxy, proxyAsCounter, implementationV2, CounterV2 } = await loadFixture(deployContractFixture);
      
      // Increment with V1
      await proxyAsCounter.increment();
      expect(await proxyAsCounter.getCount()).to.equal(1);
      
      // Upgrade to V2
      await proxy.upgradeTo(await implementationV2.getAddress());
      const proxyAsCounterV2 = CounterV2.attach(proxy.target);
      
      // Check state is maintained
      expect(await proxyAsCounterV2.getCount()).to.equal(1);
      
      // Use new V2 functionality
      await proxyAsCounterV2.decrement();
      expect(await proxyAsCounterV2.getCount()).to.equal(0);
    });

    it("Should prevent non-admin from upgrading", async function () {
      const { proxy, implementationV2, otherAccount } = await loadFixture(deployContractFixture);
      
      await expect(
        proxy.connect(otherAccount).upgradeTo(await implementationV2.getAddress())
      ).to.be.reverted;
    });
  });

  describe("V2 Functionality", function () {
    async function upgradeToV2Fixture() {
      const deployment = await deployContractFixture();
      await deployment.proxy.upgradeTo(await deployment.implementationV2.getAddress());
      const proxyAsCounterV2 = deployment.CounterV2.attach(deployment.proxy.target);
      return { ...deployment, proxyAsCounterV2 };
    }

    it("Should increment by amount", async function () {
      const { proxyAsCounterV2 } = await loadFixture(upgradeToV2Fixture);
      
      await proxyAsCounterV2.incrementBy(5);
      expect(await proxyAsCounterV2.getCount()).to.equal(5);
    });

    it("Should decrement counter", async function () {
      const { proxyAsCounterV2 } = await loadFixture(upgradeToV2Fixture);
      
      await proxyAsCounterV2.incrementBy(2);
      await proxyAsCounterV2.decrement();
      expect(await proxyAsCounterV2.getCount()).to.equal(1);
    });

    it("Should prevent decrement below zero", async function () {
      const { proxyAsCounterV2 } = await loadFixture(upgradeToV2Fixture);
      
      await expect(proxyAsCounterV2.decrement()).to.be.revertedWith(
        "Count cannot be negative"
      );
    });
  });
});
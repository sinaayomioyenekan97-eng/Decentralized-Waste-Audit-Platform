import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_HASH = 102;
const ERR_INVALID_TONNAGE = 103;
const ERR_INVALID_WASTE_TYPE = 104;
const ERR_INVALID_REDUCTION_METRIC = 105;
const ERR_AUDIT_ALREADY_EXISTS = 106;
const ERR_AUDIT_NOT_FOUND = 107;
const ERR_INVALID_PERIOD = 110;
const ERR_INVALID_CATEGORY = 111;
const ERR_INVALID_LOCATION = 116;
const ERR_INVALID_UNIT = 117;
const ERR_INVALID_SOURCE = 118;
const ERR_INVALID_VERIFICATION_LEVEL = 119;
const ERR_INVALID_COMPLIANCE_SCORE = 120;
const ERR_MAX_AUDITS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_REGISTRY_NOT_VERIFIED = 109;

interface Audit {
  submitter: string;
  dataHash: Uint8Array;
  tonnage: number;
  wasteType: string;
  reductionMetric: number;
  timestamp: number;
  period: number;
  category: string;
  location: string;
  unit: string;
  source: string;
  verificationLevel: number;
  complianceScore: number;
  status: boolean;
}

interface AuditUpdate {
  updateTonnage: number;
  updateReductionMetric: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class AuditSubmissionMock {
  state: {
    nextAuditId: number;
    maxAudits: number;
    submissionFee: number;
    registryContract: string | null;
    audits: Map<number, Audit>;
    auditUpdates: Map<number, AuditUpdate>;
    auditsByHash: Map<string, number>;
  } = {
    nextAuditId: 0,
    maxAudits: 10000,
    submissionFee: 500,
    registryContract: null,
    audits: new Map(),
    auditUpdates: new Map(),
    auditsByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  registries: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextAuditId: 0,
      maxAudits: 10000,
      submissionFee: 500,
      registryContract: null,
      audits: new Map(),
      auditUpdates: new Map(),
      auditsByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.registries = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedRegistry(principal: string): Result<boolean> {
    return { ok: true, value: this.registries.has(principal) };
  }

  setRegistryContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.registryContract !== null) {
      return { ok: false, value: false };
    }
    this.state.registryContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.registryContract) return { ok: false, value: false };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  submitAudit(
    dataHash: Uint8Array,
    tonnage: number,
    wasteType: string,
    reductionMetric: number,
    period: number,
    category: string,
    location: string,
    unit: string,
    source: string,
    verificationLevel: number,
    complianceScore: number
  ): Result<number> {
    if (this.state.nextAuditId >= this.state.maxAudits) return { ok: false, value: ERR_MAX_AUDITS_EXCEEDED };
    if (dataHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (tonnage <= 0) return { ok: false, value: ERR_INVALID_TONNAGE };
    if (!wasteType || wasteType.length > 50) return { ok: false, value: ERR_INVALID_WASTE_TYPE };
    if (reductionMetric > 100) return { ok: false, value: ERR_INVALID_REDUCTION_METRIC };
    if (period <= 0) return { ok: false, value: ERR_INVALID_PERIOD };
    if (!["organic", "recyclable", "hazardous"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["kg", "ton", "lb"].includes(unit)) return { ok: false, value: ERR_INVALID_UNIT };
    if (!source || source.length > 100) return { ok: false, value: ERR_INVALID_SOURCE };
    if (verificationLevel > 5) return { ok: false, value: ERR_INVALID_VERIFICATION_LEVEL };
    if (complianceScore > 100) return { ok: false, value: ERR_INVALID_COMPLIANCE_SCORE };
    if (!this.isVerifiedRegistry(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const hashKey = dataHash.toString();
    if (this.state.auditsByHash.has(hashKey)) return { ok: false, value: ERR_AUDIT_ALREADY_EXISTS };
    if (!this.state.registryContract) return { ok: false, value: ERR_REGISTRY_NOT_VERIFIED };
    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.registryContract });
    const id = this.state.nextAuditId;
    const audit: Audit = {
      submitter: this.caller,
      dataHash,
      tonnage,
      wasteType,
      reductionMetric,
      timestamp: this.blockHeight,
      period,
      category,
      location,
      unit,
      source,
      verificationLevel,
      complianceScore,
      status: true,
    };
    this.state.audits.set(id, audit);
    this.state.auditsByHash.set(hashKey, id);
    this.state.nextAuditId++;
    return { ok: true, value: id };
  }

  getAudit(id: number): Audit | null {
    return this.state.audits.get(id) || null;
  }

  updateAudit(id: number, updateTonnage: number, updateReductionMetric: number): Result<boolean> {
    const audit = this.state.audits.get(id);
    if (!audit) return { ok: false, value: false };
    if (audit.submitter !== this.caller) return { ok: false, value: false };
    if (updateTonnage <= 0) return { ok: false, value: false };
    if (updateReductionMetric > 100) return { ok: false, value: false };
    const updated: Audit = {
      ...audit,
      tonnage: updateTonnage,
      reductionMetric: updateReductionMetric,
      timestamp: this.blockHeight,
    };
    this.state.audits.set(id, updated);
    this.state.auditUpdates.set(id, {
      updateTonnage,
      updateReductionMetric,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getAuditCount(): Result<number> {
    return { ok: true, value: this.state.nextAuditId };
  }

  checkAuditExistence(dataHash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.auditsByHash.has(dataHash.toString()) };
  }
}

describe("AuditSubmission", () => {
  let contract: AuditSubmissionMock;
  beforeEach(() => {
    contract = new AuditSubmissionMock();
    contract.reset();
  });

  it("submits an audit successfully", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(1);
    const result = contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const audit = contract.getAudit(0);
    expect(audit?.tonnage).toBe(100);
    expect(audit?.wasteType).toBe("Plastic");
    expect(audit?.reductionMetric).toBe(20);
    expect(audit?.category).toBe("recyclable");
    expect(audit?.location).toBe("CityA");
    expect(audit?.unit).toBe("ton");
    expect(audit?.source).toBe("FactoryX");
    expect(audit?.verificationLevel).toBe(3);
    expect(audit?.complianceScore).toBe(85);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate audit hashes", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(1);
    contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    const result = contract.submitAudit(
      dataHash,
      200,
      "Metal",
      30,
      2,
      "organic",
      "CityB",
      "kg",
      "PlantY",
      4,
      90
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUDIT_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setRegistryContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.registries = new Set();
    const dataHash = new Uint8Array(32).fill(2);
    const result = contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects audit submission without registry contract", () => {
    const dataHash = new Uint8Array(32).fill(3);
    const result = contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REGISTRY_NOT_VERIFIED);
  });

  it("rejects invalid tonnage", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(4);
    const result = contract.submitAudit(
      dataHash,
      0,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TONNAGE);
  });

  it("rejects invalid category", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(5);
    const result = contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "invalid",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("updates an audit successfully", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(6);
    contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    const result = contract.updateAudit(0, 150, 25);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const audit = contract.getAudit(0);
    expect(audit?.tonnage).toBe(150);
    expect(audit?.reductionMetric).toBe(25);
    const update = contract.state.auditUpdates.get(0);
    expect(update?.updateTonnage).toBe(150);
    expect(update?.updateReductionMetric).toBe(25);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent audit", () => {
    contract.setRegistryContract("ST2TEST");
    const result = contract.updateAudit(99, 150, 25);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-submitter", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(7);
    contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateAudit(0, 150, 25);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets submission fee successfully", () => {
    contract.setRegistryContract("ST2TEST");
    const result = contract.setSubmissionFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(1000);
    const dataHash = new Uint8Array(32).fill(8);
    contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects submission fee change without registry contract", () => {
    const result = contract.setSubmissionFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct audit count", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash1 = new Uint8Array(32).fill(9);
    contract.submitAudit(
      dataHash1,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    const dataHash2 = new Uint8Array(32).fill(10);
    contract.submitAudit(
      dataHash2,
      200,
      "Metal",
      30,
      2,
      "organic",
      "CityB",
      "kg",
      "PlantY",
      4,
      90
    );
    const result = contract.getAuditCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks audit existence correctly", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(11);
    contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    const result = contract.checkAuditExistence(dataHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(12);
    const result2 = contract.checkAuditExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects audit submission with invalid hash length", () => {
    contract.setRegistryContract("ST2TEST");
    const dataHash = new Uint8Array(31).fill(14);
    const result = contract.submitAudit(
      dataHash,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects audit submission with max audits exceeded", () => {
    contract.setRegistryContract("ST2TEST");
    contract.state.maxAudits = 1;
    const dataHash1 = new Uint8Array(32).fill(15);
    contract.submitAudit(
      dataHash1,
      100,
      "Plastic",
      20,
      1,
      "recyclable",
      "CityA",
      "ton",
      "FactoryX",
      3,
      85
    );
    const dataHash2 = new Uint8Array(32).fill(16);
    const result = contract.submitAudit(
      dataHash2,
      200,
      "Metal",
      30,
      2,
      "organic",
      "CityB",
      "kg",
      "PlantY",
      4,
      90
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_AUDITS_EXCEEDED);
  });

  it("sets registry contract successfully", () => {
    const result = contract.setRegistryContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registryContract).toBe("ST2TEST");
  });

  it("rejects invalid registry contract", () => {
    const result = contract.setRegistryContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});
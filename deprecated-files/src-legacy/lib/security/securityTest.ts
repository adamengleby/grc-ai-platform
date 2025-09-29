/**
 * Security Implementation Test Suite
 * Validates tenant isolation, request signing, and audit logging
 */

import { tenantValidator, TenantValidationContext } from './tenantValidator';
import { requestSigner } from './requestSigner';
import { securityAuditLogger } from './auditLogger';
import { enhancedSessionValidator } from './sessionValidator';

export interface SecurityTestResult {
  testName: string;
  passed: boolean;
  details: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class SecurityTester {
  private testResults: SecurityTestResult[] = [];

  /**
   * Run comprehensive security tests
   */
  async runSecurityTests(): Promise<SecurityTestResult[]> {
    console.log('🔐 Starting Security Implementation Tests...');
    
    this.testResults = [];

    // Test 1: Tenant Validation
    await this.testTenantValidation();
    
    // Test 2: Request Signing
    await this.testRequestSigning();
    
    // Test 3: Audit Logging
    await this.testAuditLogging();
    
    // Test 4: Session Security
    await this.testSessionSecurity();
    
    // Test 5: Cross-Tenant Access Prevention
    await this.testCrossTenantPrevention();

    console.log('🔐 Security Tests Completed');
    this.printTestSummary();
    
    return this.testResults;
  }

  /**
   * Test tenant validation middleware
   */
  private async testTenantValidation(): Promise<void> {
    try {
      console.log('Testing tenant validation...');

      // Test 1: Valid tenant access
      const validContext: TenantValidationContext = {
        userId: 'user-001',
        tenantId: 'tenant-manufacturing-003',
        userRoles: ['TenantOwner'],
        sessionToken: 'valid.session.token',
        requestTimestamp: Date.now()
      };

      const isValid = await tenantValidator.validateTenantAccess(validContext);
      
      this.addTestResult({
        testName: 'Valid Tenant Access',
        passed: isValid === true,
        details: isValid ? 'Tenant validation passed for valid user' : 'Tenant validation failed for valid user',
        riskLevel: isValid ? 'LOW' : 'HIGH'
      });

      // Test 2: Invalid tenant access (wrong user)
      try {
        const invalidContext: TenantValidationContext = {
          userId: 'user-999', // Non-existent user
          tenantId: 'tenant-manufacturing-003',
          userRoles: ['TenantOwner'],
          sessionToken: 'valid.session.token',
          requestTimestamp: Date.now()
        };

        await tenantValidator.validateTenantAccess(invalidContext);
        
        this.addTestResult({
          testName: 'Invalid User Rejection',
          passed: false,
          details: 'Invalid user was incorrectly allowed access',
          riskLevel: 'CRITICAL'
        });
        
      } catch (error) {
        this.addTestResult({
          testName: 'Invalid User Rejection',
          passed: true,
          details: 'Invalid user was correctly rejected',
          riskLevel: 'LOW'
        });
      }

      // Test 3: Timestamp replay attack prevention
      try {
        const replayContext: TenantValidationContext = {
          userId: 'user-001',
          tenantId: 'tenant-manufacturing-003',
          userRoles: ['TenantOwner'],
          sessionToken: 'valid.session.token',
          requestTimestamp: Date.now() - (10 * 60 * 1000) // 10 minutes ago
        };

        await tenantValidator.validateTenantAccess(replayContext);
        
        this.addTestResult({
          testName: 'Replay Attack Prevention',
          passed: false,
          details: 'Old timestamp was incorrectly accepted',
          riskLevel: 'HIGH'
        });
        
      } catch (error) {
        this.addTestResult({
          testName: 'Replay Attack Prevention',
          passed: true,
          details: 'Old timestamp was correctly rejected',
          riskLevel: 'LOW'
        });
      }

    } catch (error) {
      this.addTestResult({
        testName: 'Tenant Validation System',
        passed: false,
        details: `Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        riskLevel: 'CRITICAL'
      });
    }
  }

  /**
   * Test request signing functionality
   */
  private async testRequestSigning(): Promise<void> {
    try {
      console.log('Testing request signing...');

      // Test 1: Sign and verify valid request
      const testPayload = {
        operation: 'test_operation',
        data: { key: 'value' }
      };

      const signedRequest = await requestSigner.signRequest(
        testPayload,
        'tenant-test',
        'user-test'
      );

      const isVerified = await requestSigner.verifyRequest(signedRequest);
      
      this.addTestResult({
        testName: 'Request Signing & Verification',
        passed: isVerified === true,
        details: isVerified ? 'Request signing and verification working correctly' : 'Request signing verification failed',
        riskLevel: isVerified ? 'LOW' : 'HIGH'
      });

      // Test 2: Detect tampered requests
      try {
        const tamperedRequest = { ...signedRequest };
        tamperedRequest.payload = { operation: 'malicious_operation' };

        const isTamperedVerified = await requestSigner.verifyRequest(tamperedRequest);
        
        this.addTestResult({
          testName: 'Tamper Detection',
          passed: isTamperedVerified === false,
          details: isTamperedVerified ? 'Tampered request was incorrectly verified' : 'Tampered request was correctly rejected',
          riskLevel: isTamperedVerified ? 'CRITICAL' : 'LOW'
        });
        
      } catch (error) {
        this.addTestResult({
          testName: 'Tamper Detection',
          passed: true,
          details: 'Tampered request was correctly rejected with error',
          riskLevel: 'LOW'
        });
      }

    } catch (error) {
      this.addTestResult({
        testName: 'Request Signing System',
        passed: false,
        details: `Signing system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        riskLevel: 'HIGH'
      });
    }
  }

  /**
   * Test audit logging functionality
   */
  private async testAuditLogging(): Promise<void> {
    try {
      console.log('Testing audit logging...');

      // Test 1: Log security violation
      const eventId = await securityAuditLogger.logSecurityViolation(
        'tenant-test',
        'user-test',
        'TEST_VIOLATION',
        { testData: 'security_test' }
      );

      const events = securityAuditLogger.queryEvents({
        tenantId: 'tenant-test',
        eventType: 'SECURITY_VIOLATION',
        limit: 1
      });

      const testEvent = events.find(e => e.id === eventId);
      
      this.addTestResult({
        testName: 'Audit Event Logging',
        passed: !!testEvent && testEvent.action === 'SECURITY_VIOLATION_TEST_VIOLATION',
        details: testEvent ? 'Audit event logged successfully' : 'Audit event not found',
        riskLevel: testEvent ? 'LOW' : 'MEDIUM'
      });

      // Test 2: Test audit log integrity
      if (testEvent) {
        const integrityCheck = await securityAuditLogger.verifyIntegrity([eventId]);
        
        this.addTestResult({
          testName: 'Audit Log Integrity',
          passed: integrityCheck.verified && integrityCheck.tamperedEvents.length === 0,
          details: integrityCheck.verified ? 'Audit log integrity maintained' : 'Audit log integrity compromised',
          riskLevel: integrityCheck.verified ? 'LOW' : 'CRITICAL'
        });
      }

      // Test 3: Generate audit summary
      const summary = securityAuditLogger.generateAuditSummary('tenant-test');
      
      this.addTestResult({
        testName: 'Audit Summary Generation',
        passed: summary.totalEvents > 0 && typeof summary.riskScore === 'number',
        details: `Generated summary with ${summary.totalEvents} events and risk score ${summary.riskScore}`,
        riskLevel: 'LOW'
      });

    } catch (error) {
      this.addTestResult({
        testName: 'Audit Logging System',
        passed: false,
        details: `Audit system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        riskLevel: 'HIGH'
      });
    }
  }

  /**
   * Test session security functionality
   */
  private async testSessionSecurity(): Promise<void> {
    try {
      console.log('Testing session security...');

      // Test 1: Create and validate session
      const sessionContext = await enhancedSessionValidator.createSession(
        'user-test',
        'tenant-test',
        ['TenantOwner'],
        'Mozilla/5.0 Test Browser',
        '127.0.0.1'
      );

      const validation = await enhancedSessionValidator.validateSession(
        sessionContext.sessionId,
        'Mozilla/5.0 Test Browser',
        '127.0.0.1'
      );
      
      this.addTestResult({
        testName: 'Session Creation & Validation',
        passed: validation.valid === true && !validation.requiresReauth,
        details: validation.valid ? 'Session created and validated successfully' : `Session validation failed: ${validation.violations.join(', ')}`,
        riskLevel: validation.valid ? 'LOW' : 'MEDIUM'
      });

      // Test 2: Detect session hijacking attempt
      const hijackValidation = await enhancedSessionValidator.validateSession(
        sessionContext.sessionId,
        'Mozilla/5.0 Malicious Browser', // Different user agent
        '192.168.1.100' // Different IP
      );
      
      this.addTestResult({
        testName: 'Session Hijacking Detection',
        passed: hijackValidation.riskScore >= 5.0 || hijackValidation.violations.length > 0,
        details: `Risk score: ${hijackValidation.riskScore}, Violations: ${hijackValidation.violations.join(', ')}`,
        riskLevel: hijackValidation.riskScore >= 5.0 ? 'LOW' : 'HIGH'
      });

      // Test 3: Tenant access within session
      const tenantAccess = await enhancedSessionValidator.validateTenantAccess(
        sessionContext.sessionId,
        'tenant-test'
      );
      
      this.addTestResult({
        testName: 'Session Tenant Access',
        passed: tenantAccess === true,
        details: tenantAccess ? 'Tenant access correctly validated' : 'Tenant access incorrectly denied',
        riskLevel: tenantAccess ? 'LOW' : 'MEDIUM'
      });

    } catch (error) {
      this.addTestResult({
        testName: 'Session Security System',
        passed: false,
        details: `Session system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        riskLevel: 'HIGH'
      });
    }
  }

  /**
   * Test cross-tenant access prevention
   */
  private async testCrossTenantPrevention(): Promise<void> {
    try {
      console.log('Testing cross-tenant access prevention...');

      // Test attempting to access different tenant
      try {
        const crossTenantContext: TenantValidationContext = {
          userId: 'user-001', // ACME user
          tenantId: 'tenant-fintech', // But trying to access fintech tenant
          userRoles: ['TenantOwner'],
          sessionToken: 'valid.session.token',
          requestTimestamp: Date.now()
        };

        await tenantValidator.validateTenantAccess(crossTenantContext);
        
        this.addTestResult({
          testName: 'Cross-Tenant Access Prevention',
          passed: false,
          details: 'Cross-tenant access was incorrectly allowed',
          riskLevel: 'CRITICAL'
        });
        
      } catch (error) {
        this.addTestResult({
          testName: 'Cross-Tenant Access Prevention',
          passed: true,
          details: 'Cross-tenant access was correctly blocked',
          riskLevel: 'LOW'
        });
      }

    } catch (error) {
      this.addTestResult({
        testName: 'Cross-Tenant Prevention System',
        passed: false,
        details: `Cross-tenant system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        riskLevel: 'HIGH'
      });
    }
  }

  /**
   * Add test result to collection
   */
  private addTestResult(result: SecurityTestResult): void {
    this.testResults.push(result);
    const status = result.passed ? '✅' : '❌';
    const risk = result.riskLevel === 'CRITICAL' ? '🚨' : result.riskLevel === 'HIGH' ? '⚠️' : '';
    console.log(`${status} ${result.testName} ${risk}`);
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const criticalFailures = this.testResults.filter(r => !r.passed && r.riskLevel === 'CRITICAL').length;
    const highRiskFailures = this.testResults.filter(r => !r.passed && r.riskLevel === 'HIGH').length;

    console.log('\n🔐 Security Test Summary:');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    if (criticalFailures > 0) {
      console.log(`🚨 Critical Security Issues: ${criticalFailures}`);
    }
    
    if (highRiskFailures > 0) {
      console.log(`⚠️ High Risk Issues: ${highRiskFailures}`);
    }

    if (criticalFailures === 0 && highRiskFailures === 0) {
      console.log('🛡️ Security implementation appears robust');
    } else {
      console.log('🔥 Security issues detected - review required');
    }
  }

  /**
   * Get overall security score
   */
  getSecurityScore(): {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendation: string;
  } {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const criticalFailures = this.testResults.filter(r => !r.passed && r.riskLevel === 'CRITICAL').length;
    const highRiskFailures = this.testResults.filter(r => !r.passed && r.riskLevel === 'HIGH').length;

    let score = (passed / total) * 100;
    
    // Penalize critical and high-risk failures heavily
    score -= (criticalFailures * 25);
    score -= (highRiskFailures * 15);
    score = Math.max(0, score);

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    let recommendation: string;

    if (score >= 90 && criticalFailures === 0) {
      grade = 'A';
      recommendation = 'Security implementation is excellent and ready for production.';
    } else if (score >= 80 && criticalFailures === 0) {
      grade = 'B';
      recommendation = 'Security implementation is good with minor improvements needed.';
    } else if (score >= 70 && criticalFailures === 0) {
      grade = 'C';
      recommendation = 'Security implementation needs improvement before production.';
    } else if (score >= 60) {
      grade = 'D';
      recommendation = 'Security implementation has significant issues requiring immediate attention.';
    } else {
      grade = 'F';
      recommendation = 'Security implementation is inadequate and must be fixed before deployment.';
    }

    return { score: Math.round(score), grade, recommendation };
  }
}

// Export test runner
export const runSecurityTests = async (): Promise<SecurityTestResult[]> => {
  const tester = new SecurityTester();
  return tester.runSecurityTests();
};
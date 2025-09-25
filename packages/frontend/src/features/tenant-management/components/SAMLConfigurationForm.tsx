import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Alert } from '@/app/components/ui/Alert';
import { Badge } from '@/app/components/ui/Badge';
import {
  Shield,
  Key,
  Link,
  FileText,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  TestTube
} from 'lucide-react';
import { tenantManagementApi } from '../services/tenantManagementApi';
import { Tenant, TenantSAMLConfig, SAMLConfigFormData, SAMLTestResult } from '../types';

interface SAMLConfigurationFormProps {
  tenant: Tenant;
  canModify: boolean;
  onClose: () => void;
}

export function SAMLConfigurationForm({ tenant, canModify, onClose }: SAMLConfigurationFormProps) {
  const [config, setConfig] = useState<TenantSAMLConfig | null>(null);
  const [formData, setFormData] = useState<SAMLConfigFormData>({
    idp_entity_id: '',
    idp_sso_url: '',
    idp_x509_certificate: '',
    sp_entity_id: `urn:${tenant.slug}:saml:sp`,
    sp_acs_url: `${window.location.origin}/api/v1/auth/saml/${tenant.slug}/callback`,
    sp_private_key: '',
    sp_x509_certificate: '',
    name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    signature_algorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    digest_algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    require_signed_assertions: true,
    require_signed_response: false,
    email_attribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    first_name_attribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    last_name_attribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    groups_attribute: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
    session_timeout_minutes: 480,
    is_enabled: false
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SAMLTestResult | null>(null);

  useEffect(() => {
    loadSAMLConfig();
  }, [tenant.tenant_id]);

  const loadSAMLConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const samlConfig = await tenantManagementApi.getTenantSAMLConfig(tenant.tenant_id);
      
      if (samlConfig) {
        setConfig(samlConfig);
        setFormData({
          idp_entity_id: samlConfig.idp_entity_id,
          idp_sso_url: samlConfig.idp_sso_url,
          idp_x509_certificate: samlConfig.idp_x509_certificate,
          sp_entity_id: samlConfig.sp_entity_id,
          sp_acs_url: samlConfig.sp_acs_url,
          sp_private_key: samlConfig.sp_private_key || '',
          sp_x509_certificate: samlConfig.sp_x509_certificate || '',
          name_id_format: samlConfig.name_id_format,
          signature_algorithm: samlConfig.signature_algorithm,
          digest_algorithm: samlConfig.digest_algorithm,
          require_signed_assertions: samlConfig.require_signed_assertions,
          require_signed_response: samlConfig.require_signed_response,
          email_attribute: samlConfig.email_attribute,
          first_name_attribute: samlConfig.first_name_attribute,
          last_name_attribute: samlConfig.last_name_attribute,
          groups_attribute: samlConfig.groups_attribute,
          session_timeout_minutes: samlConfig.session_timeout_minutes,
          is_enabled: samlConfig.is_enabled
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SAML configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const configRequest = {
        tenant_id: tenant.tenant_id,
        saml_config: formData
      };

      if (config) {
        await tenantManagementApi.updateTenantSAML(tenant.tenant_id, configRequest);
        setSuccess('SAML configuration updated successfully');
      } else {
        await tenantManagementApi.configureTenantSAML(tenant.tenant_id, configRequest);
        setSuccess('SAML configuration created successfully');
      }

      await loadSAMLConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SAML configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setError(null);
      const result = await tenantManagementApi.testSAMLAuth(tenant.slug);
      setTestResult(result);
      
      if (result.valid) {
        setSuccess('SAML configuration test passed');
      } else {
        setError(`SAML test failed: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test SAML configuration');
    } finally {
      setTesting(false);
    }
  };

  const downloadMetadata = async () => {
    try {
      const metadata = await tenantManagementApi.generateSAMLMetadata(tenant.slug);
      const blob = new Blob([metadata], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tenant.slug}-saml-metadata.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to generate SAML metadata');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <CardTitle>SAML Configuration - {tenant.name}</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Status Messages */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-red-800">{error}</span>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-800">{success}</span>
            </Alert>
          )}

          {/* Configuration Status */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div>
                    <p className="font-medium">Configuration Status</p>
                    <p className="text-sm text-gray-500">
                      {config ? 'SAML is configured' : 'No SAML configuration found'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {config ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {config.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Configured</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identity Provider Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>Identity Provider Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IdP Entity ID *
                </label>
                <input
                  type="text"
                  value={formData.idp_entity_id}
                  onChange={(e) => setFormData({...formData, idp_entity_id: e.target.value})}
                  disabled={!canModify}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="https://adfs.company.com/adfs/services/trust"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IdP SSO URL *
                </label>
                <input
                  type="url"
                  value={formData.idp_sso_url}
                  onChange={(e) => setFormData({...formData, idp_sso_url: e.target.value})}
                  disabled={!canModify}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="https://adfs.company.com/adfs/ls/"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IdP X.509 Certificate *
                </label>
                <textarea
                  value={formData.idp_x509_certificate}
                  onChange={(e) => setFormData({...formData, idp_x509_certificate: e.target.value})}
                  disabled={!canModify}
                  rows={6}
                  className="w-full p-2 border border-gray-300 rounded-md font-mono text-xs"
                  placeholder="-----BEGIN CERTIFICATE-----&#10;MIIFj...&#10;-----END CERTIFICATE-----"
                />
              </div>
            </CardContent>
          </Card>

          {/* Service Provider Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Link className="h-5 w-5" />
                <span>Service Provider Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SP Entity ID
                </label>
                <input
                  type="text"
                  value={formData.sp_entity_id}
                  onChange={(e) => setFormData({...formData, sp_entity_id: e.target.value})}
                  disabled={!canModify}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SP Assertion Consumer Service URL
                </label>
                <input
                  type="url"
                  value={formData.sp_acs_url}
                  onChange={(e) => setFormData({...formData, sp_acs_url: e.target.value})}
                  disabled={!canModify}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.require_signed_assertions}
                    onChange={(e) => setFormData({...formData, require_signed_assertions: e.target.checked})}
                    disabled={!canModify}
                  />
                  <span className="text-sm">Require Signed Assertions</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.require_signed_response}
                    onChange={(e) => setFormData({...formData, require_signed_response: e.target.checked})}
                    disabled={!canModify}
                  />
                  <span className="text-sm">Require Signed Response</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={formData.session_timeout_minutes}
                  onChange={(e) => setFormData({...formData, session_timeout_minutes: parseInt(e.target.value)})}
                  disabled={!canModify}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  min="30"
                  max="1440"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <button
                onClick={downloadMetadata}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                <Download className="h-4 w-4" />
                <span>Download Metadata</span>
              </button>
              
              {config && (
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm disabled:opacity-50"
                >
                  <TestTube className="h-4 w-4" />
                  <span>{testing ? 'Testing...' : 'Test Configuration'}</span>
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              {canModify && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : config ? 'Update Configuration' : 'Create Configuration'}
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
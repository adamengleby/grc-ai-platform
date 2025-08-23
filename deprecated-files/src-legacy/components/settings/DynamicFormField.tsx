import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import {
  Eye,
  EyeOff,
  Info,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { ConfigField } from '@/types/mcp-config';

interface DynamicFormFieldProps {
  field: ConfigField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  showSensitive?: boolean;
  onToggleSensitive?: () => void;
}

export function DynamicFormField({
  field,
  value,
  onChange,
  error,
  disabled = false,
  showSensitive = false,
  onToggleSensitive
}: DynamicFormFieldProps) {
  const [keyValuePairs, setKeyValuePairs] = useState<Array<{ key: string; value: string }>>(
    field.type === 'key-value' ? Object.entries(value || {}).map(([k, v]) => ({ key: k, value: String(v) })) : []
  );

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'password':
        return (
          <div className="relative">
            <Input
              type={showSensitive ? 'text' : 'password'}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              className={error ? 'border-red-500 pr-10' : 'pr-10'}
            />
            {onToggleSensitive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={onToggleSensitive}
                disabled={disabled}
              >
                {showSensitive ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            )}
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {field.description || `Enable ${field.label.toLowerCase()}`}
            </span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`
              w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
              ${error ? 'border-red-500' : ''}
            `}
          >
            <option value="">Select an option...</option>
            {field.options?.map((option) => (
              <option 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multi-select':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...currentValues, option.value]);
                    } else {
                      onChange(currentValues.filter(v => v !== option.value));
                    }
                  }}
                  disabled={disabled || option.disabled}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm text-gray-900">{option.label}</span>
                  {option.description && (
                    <p className="text-xs text-gray-500">{option.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
            rows={4}
          />
        );

      case 'json':
        return (
          <div className="space-y-2">
            <Textarea
              value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange(parsed);
                } catch {
                  onChange(e.target.value);
                }
              }}
              placeholder={field.placeholder || '{\n  "key": "value"\n}'}
              disabled={disabled}
              className={error ? 'border-red-500' : 'font-mono text-sm'}
              rows={6}
            />
            <p className="text-xs text-gray-500">
              Enter valid JSON format
            </p>
          </div>
        );

      case 'key-value':
        return (
          <div className="space-y-3">
            {keyValuePairs.map((pair, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  placeholder="Key"
                  value={pair.key}
                  onChange={(e) => {
                    const newPairs = [...keyValuePairs];
                    newPairs[index].key = e.target.value;
                    setKeyValuePairs(newPairs);
                    
                    const obj: Record<string, string> = {};
                    newPairs.forEach(p => {
                      if (p.key && p.value) {
                        obj[p.key] = p.value;
                      }
                    });
                    onChange(obj);
                  }}
                  disabled={disabled}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={pair.value}
                  onChange={(e) => {
                    const newPairs = [...keyValuePairs];
                    newPairs[index].value = e.target.value;
                    setKeyValuePairs(newPairs);
                    
                    const obj: Record<string, string> = {};
                    newPairs.forEach(p => {
                      if (p.key && p.value) {
                        obj[p.key] = p.value;
                      }
                    });
                    onChange(obj);
                  }}
                  disabled={disabled}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newPairs = keyValuePairs.filter((_, i) => i !== index);
                    setKeyValuePairs(newPairs);
                    
                    const obj: Record<string, string> = {};
                    newPairs.forEach(p => {
                      if (p.key && p.value) {
                        obj[p.key] = p.value;
                      }
                    });
                    onChange(obj);
                  }}
                  disabled={disabled}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setKeyValuePairs([...keyValuePairs, { key: '', value: '' }]);
              }}
              disabled={disabled}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
        );

      default:
        return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>Unsupported field type: {field.type}</span>
          </Alert>
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.id} className="text-sm font-medium text-gray-900">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
          {field.sensitive && (
            <Badge variant="outline" className="ml-2 text-xs">
              Sensitive
            </Badge>
          )}
        </Label>
        
        {field.description && (
          <div className="group relative">
            <Info className="h-4 w-4 text-gray-400 cursor-help" />
            <div className="absolute right-0 bottom-6 hidden group-hover:block z-10 w-64 p-2 text-xs text-white bg-gray-900 rounded shadow-lg">
              {field.description}
            </div>
          </div>
        )}
      </div>

      {renderField()}

      {error && (
        <div className="flex items-center space-x-1 text-red-600">
          <AlertTriangle className="h-3 w-3" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {field.type === 'multi-select' && Array.isArray(value) && value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((selectedValue) => {
            const option = field.options?.find(opt => opt.value === selectedValue);
            return (
              <Badge key={selectedValue} variant="secondary" className="text-xs">
                {option?.label || selectedValue}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
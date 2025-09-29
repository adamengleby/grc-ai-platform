/**
 * Event Stream Viewer Component
 * Real-time monitoring of GRC events and system activities
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  Activity,
  AlertTriangle,
  Shield,
  Target,
  User,
  Server,
  Database,
  Clock,
  Filter,
  Pause,
  Play,
  Download,
  Search,
  Zap,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { EventStream } from '../types';

interface EventStreamViewerProps {
  events: EventStream[];
  tenantId: string;
  isLoading: boolean;
}

interface EventFilters {
  severity: string[];
  eventType: string[];
  source: string[];
  timeRange: string;
}

export const EventStreamViewer: React.FC<EventStreamViewerProps> = ({
  events: initialEvents,
  tenantId: _tenantId,
  isLoading
}) => {
  const [events, setEvents] = useState<EventStream[]>(initialEvents);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [filters, setFilters] = useState<EventFilters>({
    severity: [],
    eventType: [],
    source: [],
    timeRange: 'all'
  });

  const eventsContainerRef = useRef<HTMLDivElement>(null);
  const eventCountRef = useRef(events.length);

  // Update events when props change
  useEffect(() => {
    if (!isPaused) {
      setEvents(initialEvents);
    }
  }, [initialEvents, isPaused]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && events.length > eventCountRef.current && eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
    eventCountRef.current = events.length;
  }, [events, autoScroll]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'info': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('RISK')) return AlertTriangle;
    if (eventType.includes('COMPLIANCE')) return Shield;
    if (eventType.includes('CONTROL')) return Target;
    if (eventType.includes('USER')) return User;
    if (eventType.includes('SYSTEM')) return Server;
    if (eventType.includes('DATA')) return Database;
    if (eventType.includes('SECURITY')) return Shield;
    if (eventType.includes('PERFORMANCE')) return Zap;
    if (eventType.includes('AUDIT')) return FileText;
    return Activity;
  };

  const filteredEvents = events.filter(event => {
    if (searchTerm && !event.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !event.eventType.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !event.source.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    if (filters.severity.length > 0 && !filters.severity.includes(event.severity)) {
      return false;
    }
    
    if (filters.eventType.length > 0 && !filters.eventType.some(type => event.eventType.includes(type))) {
      return false;
    }
    
    if (filters.source.length > 0 && !filters.source.includes(event.source)) {
      return false;
    }

    // Time range filtering
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const eventTime = new Date(event.timestamp);
      const diffHours = (now.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
      
      switch (filters.timeRange) {
        case '1h': return diffHours <= 1;
        case '6h': return diffHours <= 6;
        case '24h': return diffHours <= 24;
        default: return true;
      }
    }

    return true;
  });

  const eventStats = {
    total: filteredEvents.length,
    critical: filteredEvents.filter(e => e.severity === 'critical').length,
    high: filteredEvents.filter(e => e.severity === 'high').length,
    medium: filteredEvents.filter(e => e.severity === 'medium').length,
    low: filteredEvents.filter(e => e.severity === 'low').length
  };

  const uniqueSources = Array.from(new Set(events.map(e => e.source)));
  const uniqueEventTypes = Array.from(new Set(events.map(e => {
    const type = e.eventType.split('_')[0];
    return type;
  })));

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Live Event Stream</h2>
          <Badge variant="secondary" className="text-xs">
            {filteredEvents.length} events
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64"
            />
          </div>

          {/* Stream Controls */}
          <div className="flex items-center space-x-2">
            <Button
              variant={isPaused ? "default" : "outline"}
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="flex items-center space-x-2"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </Button>

            <Button
              variant={autoScroll ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className="flex items-center space-x-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Auto-scroll</span>
            </Button>
          </div>

          {/* Export */}
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Event Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{eventStats.total}</div>
            <div className="text-xs text-gray-600">Total Events</div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{eventStats.critical}</div>
            <div className="text-xs text-gray-600">Critical</div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-orange-500">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{eventStats.high}</div>
            <div className="text-xs text-gray-600">High</div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-yellow-500">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{eventStats.medium}</div>
            <div className="text-xs text-gray-600">Medium</div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{eventStats.low}</div>
            <div className="text-xs text-gray-600">Low</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {Math.round((events.length / Math.max(events.length, 1)) * 100)}%
            </div>
            <div className="text-xs text-gray-600">Health Score</div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-base">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Severity Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Severity</label>
              <div className="space-y-1">
                {['critical', 'high', 'medium', 'low', 'info'].map(severity => (
                  <label key={severity} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.severity.includes(severity)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters(prev => ({
                            ...prev,
                            severity: [...prev.severity, severity]
                          }));
                        } else {
                          setFilters(prev => ({
                            ...prev,
                            severity: prev.severity.filter(s => s !== severity)
                          }));
                        }
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm capitalize">{severity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Event Type Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Event Type</label>
              <div className="space-y-1">
                {uniqueEventTypes.slice(0, 5).map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.eventType.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters(prev => ({
                            ...prev,
                            eventType: [...prev.eventType, type]
                          }));
                        } else {
                          setFilters(prev => ({
                            ...prev,
                            eventType: prev.eventType.filter(t => t !== type)
                          }));
                        }
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Source Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Source</label>
              <div className="space-y-1">
                {uniqueSources.slice(0, 5).map(source => (
                  <label key={source} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.source.includes(source)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters(prev => ({
                            ...prev,
                            source: [...prev.source, source]
                          }));
                        } else {
                          setFilters(prev => ({
                            ...prev,
                            source: prev.source.filter(s => s !== source)
                          }));
                        }
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm">{source}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Time Range</label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="all">All Time</option>
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({
                severity: [],
                eventType: [],
                source: [],
                timeRange: 'all'
              })}
            >
              Clear All Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Event Stream */}
      <Card className="h-96">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <span>Event Stream</span>
              {!isPaused && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600">Live</span>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={eventsContainerRef} className="h-80 overflow-y-auto px-6 pb-6">
            <div className="space-y-2">
              {filteredEvents.map((event, _index) => {
                const Icon = getEventIcon(event.eventType);
                const isExpanded = expandedEvent === event.id;

                return (
                  <div
                    key={event.id}
                    className={`border rounded-lg p-3 transition-all duration-200 ${getSeverityColor(event.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="p-1 rounded-full bg-white bg-opacity-50">
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-sm">
                              {event.eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {event.source}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-2">
                            {event.description}
                          </p>

                          {isExpanded && event.metadata && (
                            <div className="bg-white bg-opacity-50 rounded p-3 text-xs">
                              <pre className="whitespace-pre-wrap font-mono">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <div className="text-right">
                          <Badge className={getSeverityColor(event.severity)} variant="outline">
                            {event.severity.toUpperCase()}
                          </Badge>
                          <div className="text-xs text-gray-600 mt-1 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {event.timestamp.toLocaleTimeString()}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredEvents.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No events match the current filters</p>
                  <p className="text-sm mt-1">Try adjusting your search criteria</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
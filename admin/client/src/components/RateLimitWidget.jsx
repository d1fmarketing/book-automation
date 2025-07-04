import React, { useEffect, useState } from 'react';

function RateLimitWidget({ socket }) {
    const [rateLimits, setRateLimits] = useState({});
    
    useEffect(() => {
        if (!socket) return;
        
        const handleStatusUpdate = (data) => {
            if (data.rateLimits) {
                setRateLimits(data.rateLimits);
            }
        };
        
        socket.on('status:update', handleStatusUpdate);
        
        return () => {
            socket.off('status:update', handleStatusUpdate);
        };
    }, [socket]);
    
    const getStatusColor = (service) => {
        const status = rateLimits[service];
        if (!status) return 'gray';
        
        if (status.throttle?.paused) return 'red';
        if (status.throttle?.throttled) return 'yellow';
        
        // Check usage percentages
        const percentages = Object.values(status.percentages || {})
            .map(p => parseFloat(p) || 0);
        const maxUsage = Math.max(...percentages, 0);
        
        if (maxUsage > 90) return 'red';
        if (maxUsage > 70) return 'yellow';
        return 'green';
    };
    
    const getStatusText = (service) => {
        const status = rateLimits[service];
        if (!status) return 'No data';
        
        if (status.throttle?.paused) return 'PAUSED';
        if (status.throttle?.throttled) return `Throttled (${status.throttle.delay}ms delay)`;
        
        return 'Active';
    };
    
    return (
        <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-3">API Rate Limits</h3>
            
            {Object.entries(rateLimits).map(([service, status]) => (
                <div key={service} className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{service}</span>
                        <span className={`text-sm px-2 py-1 rounded text-white bg-${getStatusColor(service)}-500`}>
                            {getStatusText(service)}
                        </span>
                    </div>
                    
                    {status.percentages && (
                        <div className="space-y-2">
                            {Object.entries(status.percentages).map(([window, percentage]) => (
                                <div key={window} className="flex items-center">
                                    <span className="text-xs text-gray-500 w-16">{window}:</span>
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-300 ${
                                                parseFloat(percentage) > 90 ? 'bg-red-500' :
                                                parseFloat(percentage) > 70 ? 'bg-yellow-500' :
                                                'bg-green-500'
                                            }`}
                                            style={{ width: percentage }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">{percentage}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {status.limits?.requests && (
                        <div className="mt-2 text-xs text-gray-500">
                            Limits: {status.limits.requests.perMinute}/min, {status.limits.requests.perHour}/hr
                        </div>
                    )}
                </div>
            ))}
            
            {Object.keys(rateLimits).length === 0 && (
                <p className="text-gray-500 text-sm">No rate limit data available</p>
            )}
        </div>
    );
}

export default RateLimitWidget;
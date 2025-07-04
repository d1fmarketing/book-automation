import React, { useEffect, useState } from 'react';

function CostTrackingWidget({ socket }) {
    const [costs, setCosts] = useState({
        daily: 0,
        monthly: 0,
        session: 0
    });
    
    const [budgets, setBudgets] = useState({
        daily: null,
        monthly: null,
        perBook: null
    });
    
    useEffect(() => {
        if (!socket) return;
        
        const handleStatusUpdate = (data) => {
            if (data.costs) {
                setCosts(data.costs);
            }
        };
        
        const handleBudgetUpdate = (data) => {
            setBudgets(data);
        };
        
        socket.on('status:update', handleStatusUpdate);
        socket.on('budgets:update', handleBudgetUpdate);
        
        // Request current budgets
        socket.emit('budgets:get');
        
        return () => {
            socket.off('status:update', handleStatusUpdate);
            socket.off('budgets:update', handleBudgetUpdate);
        };
    }, [socket]);
    
    const getProgressColor = (current, budget) => {
        if (!budget) return 'blue';
        const percentage = (current / budget) * 100;
        if (percentage > 90) return 'red';
        if (percentage > 70) return 'yellow';
        return 'green';
    };
    
    const formatCurrency = (value) => {
        return `$${(value || 0).toFixed(2)}`;
    };
    
    const getPercentage = (current, budget) => {
        if (!budget) return 0;
        return Math.min((current / budget) * 100, 100);
    };
    
    return (
        <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-3">Cost Tracking</h3>
            
            <div className="space-y-4">
                {/* Session Cost */}
                {costs.session > 0 && (
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">Current Book</span>
                            <span className="text-sm font-bold">{formatCurrency(costs.session)}</span>
                        </div>
                        {budgets.perBook && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full bg-${getProgressColor(costs.session, budgets.perBook)}-500`}
                                    style={{ width: `${getPercentage(costs.session, budgets.perBook)}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}
                
                {/* Daily Cost */}
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Daily</span>
                        <span className="text-sm">
                            {formatCurrency(costs.daily)}
                            {budgets.daily && ` / ${formatCurrency(budgets.daily)}`}
                        </span>
                    </div>
                    {budgets.daily && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full bg-${getProgressColor(costs.daily, budgets.daily)}-500`}
                                style={{ width: `${getPercentage(costs.daily, budgets.daily)}%` }}
                            />
                        </div>
                    )}
                </div>
                
                {/* Monthly Cost */}
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Monthly</span>
                        <span className="text-sm">
                            {formatCurrency(costs.monthly)}
                            {budgets.monthly && ` / ${formatCurrency(budgets.monthly)}`}
                        </span>
                    </div>
                    {budgets.monthly && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full bg-${getProgressColor(costs.monthly, budgets.monthly)}-500`}
                                style={{ width: `${getPercentage(costs.monthly, budgets.monthly)}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
            
            {/* Budget Settings */}
            <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Budget Settings</h4>
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span>Per Book:</span>
                        <span>{budgets.perBook ? formatCurrency(budgets.perBook) : 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Daily:</span>
                        <span>{budgets.daily ? formatCurrency(budgets.daily) : 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Monthly:</span>
                        <span>{budgets.monthly ? formatCurrency(budgets.monthly) : 'Not set'}</span>
                    </div>
                </div>
            </div>
            
            {/* Alerts */}
            {costs.daily > 0 && budgets.daily && costs.daily >= budgets.daily * 0.9 && (
                <div className="mt-3 p-2 bg-red-100 text-red-700 text-xs rounded">
                    ⚠️ Daily budget {costs.daily >= budgets.daily ? 'exceeded' : 'nearly reached'}!
                </div>
            )}
        </div>
    );
}

export default CostTrackingWidget;
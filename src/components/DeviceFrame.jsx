import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import './DeviceFrame.css';

const DeviceFrame = ({ children }) => {
    const [viewMode, setViewMode] = useState('pc'); // 'pc' or 'smartphone'

    // Smartphone mode: render without frame
    if (viewMode === 'smartphone') {
        return (
            <div className="smartphone-mode">
                {/* Toggle Buttons */}
                <div className="view-mode-toggle">
                    <button
                        className={viewMode === 'smartphone' ? 'active' : ''}
                        onClick={() => setViewMode('smartphone')}
                        title="Smartphone Ansicht"
                    >
                        <Smartphone size={16} />
                    </button>
                    <button
                        className={viewMode === 'pc' ? 'active' : ''}
                        onClick={() => setViewMode('pc')}
                        title="PC Ansicht (iPhone Frame)"
                    >
                        <Monitor size={16} />
                    </button>
                </div>
                {children}
            </div>
        );
    }

    // PC mode: render with iPhone frame
    return (
        <div className="device-frame-wrapper">
            {/* Toggle Buttons */}
            <div className="view-mode-toggle">
                <button
                    className={viewMode === 'smartphone' ? 'active' : ''}
                    onClick={() => setViewMode('smartphone')}
                    title="Smartphone Ansicht"
                >
                    <Smartphone size={16} />
                </button>
                <button
                    className={viewMode === 'pc' ? 'active' : ''}
                    onClick={() => setViewMode('pc')}
                    title="PC Ansicht (iPhone Frame)"
                >
                    <Monitor size={16} />
                </button>
            </div>

            <div className="iphone-frame">
                {/* Dynamic Island */}
                <div className="dynamic-island"></div>

                {/* Screen Content */}
                <div className="screen-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default DeviceFrame;

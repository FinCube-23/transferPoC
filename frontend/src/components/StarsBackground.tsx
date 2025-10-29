import React from 'react';

const StarsBackground: React.FC = () => {
  return (
    <div className="stars-background">
      <div className="stars"></div>
      <div className="stars2"></div>
      <div className="stars3"></div>
      <div className="nebula nebula-1"></div>
      <div className="nebula nebula-2"></div>
      <div className="cosmic-fog"></div>

      {/* Glowing stars */}
      <div className="stars-glowing">
        <div className="glowing-star"></div>
        <div className="glowing-star"></div>
        <div className="glowing-star"></div>
        <div className="glowing-star"></div>
        <div className="glowing-star"></div>
      </div>

      {/* Shooting stars */}
      <div className="shooting-star"></div>
      <div className="shooting-star"></div>
      <div className="shooting-star"></div>
    </div>
  );
};

export default StarsBackground;

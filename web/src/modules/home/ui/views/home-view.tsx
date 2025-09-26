"use client";

// CREDIT
// Component inspired by @BalintFerenczy on X
// https://codepen.io/BalintFerenczy/pen/KwdoyEN

import ElectricBorder from '@/components/ElectricBorder';

export const HomeView = () => {

  return (
    <div className="p-4">
      <ElectricBorder
        color="#7df9ff"
        speed={1}
        chaos={0.5}
        thickness={2}
        className=""
        style={{ borderRadius: 16 }}
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">Welcome back, [User] Ready to Practice?</h2>
          <p style={{ margin: '6px 0 0', opacity: 0.8 }}>
            A glowing, animated border wrapper around your welcome message.
          </p>
        </div>
      </ElectricBorder>
    </div>
  );
};
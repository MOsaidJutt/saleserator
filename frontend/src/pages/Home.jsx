import React from 'react';
import { Link } from 'react-router-dom';
import '../components/Home.css'; // ← add this

export default function Home() {
  return (
    <div className="home-wrap">
      <div className="home-card">
        <h2 className="home-title">Welcome to Saleserator Academy</h2>
        <p className="home-sub">
          Upskill your team with curated courses and tracked progress.
        </p>

        <div className="home-actions">
          <Link to="/signup" className="home-btn">
            Get started
          </Link>
          <Link to="/signin" className="home-btn--outline">
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}

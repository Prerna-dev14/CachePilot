import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EvaluationHardeningStudio } from '../EvaluationHardeningStudio';

describe('EvaluationHardeningStudio Component', () => {
  it('renders hardening status cards, security control audit log, and limitations matrix', () => {
    render(<EvaluationHardeningStudio selectedTenant="tenant-default" />);

    expect(
      screen.getByText('Phase 6: Adversarial Hardening & Security Assurance')
    ).toBeInTheDocument();
    expect(screen.getByText('Hardened & Verified')).toBeInTheDocument();

    // Verify status cards
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('SHA-256')).toBeInTheDocument();

    // Verify security controls
    expect(screen.getByText('Tenant Isolation & Partitioning')).toBeInTheDocument();
    expect(screen.getByText('Client Rate Limiter (Token Bucket)')).toBeInTheDocument();
    expect(screen.getByText('Secrets & Credential Masking')).toBeInTheDocument();
    expect(screen.getByText('Adversarial Scope Delimiter Collision')).toBeInTheDocument();
    expect(screen.getByText('Oversized Payload Boundary Rejection')).toBeInTheDocument();
    expect(screen.getByText('Prompt Injection Defense')).toBeInTheDocument();

    // Verify operational tradeoffs matrix
    expect(
      screen.getByText(/Semantic Threshold Precision vs\. Recall/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Non-Authoritative Billing Disclosures/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Corpus Versioning & Eventual Consistency/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Deterministic Fallback Latency Penalty/i)
    ).toBeInTheDocument();
  });

  it('triggers re-audit of security controls when button is clicked', async () => {
    render(<EvaluationHardeningStudio selectedTenant="tenant-default" />);

    const auditBtn = screen.getByRole('button', { name: /Re-Audit Controls/i });
    fireEvent.click(auditBtn);

    expect(screen.getByText(/Auditing Controls\.\.\./i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Re-Audit Controls/i)).toBeInTheDocument();
    });
  });
});

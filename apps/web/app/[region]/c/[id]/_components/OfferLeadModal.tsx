"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../page.module.css";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type Props = {
  companyId: number;
  companyName: string;
};

type LeadFormState = {
  name: string;
  phone: string;
  email: string;
  message: string;
};

const DEFAULT_FORM: LeadFormState = {
  name: "",
  phone: "",
  email: "",
  message: "",
};

export default function OfferLeadModal({ companyId, companyName }: Props) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<LeadFormState>(DEFAULT_FORM);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>("");

  const getDigits = (value: string) => value.replace(/\D/g, "");

  const formatPhone = (value: string) => {
    const raw = getDigits(value);
    let digits = raw;

    if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    if (digits.startsWith("7")) digits = digits.slice(1);

    digits = digits.slice(0, 10);

    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 10);

    let out = "+7";
    if (p1) out += ` (${p1}`;
    if (p1.length === 3) out += ")";
    if (p2) out += ` ${p2}`;
    if (p3) out += `-${p3}`;
    return out;
  };

  const isPhoneComplete = (value: string) => {
    const digits = getDigits(value);
    if (!digits) return false;
    if (digits.startsWith("8")) return digits.length === 11;
    if (digits.startsWith("7")) return digits.length === 11;
    return digits.length === 10;
  };

  useEffect(() => {
    if (searchParams?.get("offer") === "1") {
      setIsOpen(true);
    }
  }, [searchParams]);

  const canSubmit = useMemo(() => isPhoneComplete(form.phone), [form.phone]);

  const onChange =
    (key: keyof LeadFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      if (key === "phone") {
        setForm((prev) => ({ ...prev, [key]: formatPhone(value) }));
        return;
      }
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const reset = () => {
    setForm(DEFAULT_FORM);
    setError("");
    setSent(false);
  };

  const onClose = () => {
    setIsOpen(false);
    setError("");
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Укажите корректный номер телефона.");
      return;
    }

    setSending(true);
    try {
      const payload = {
        company_id: companyId,
        kind: "custom",
        custom_title: "Предложить заказ",
        contact_name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        message: form.message.trim() || undefined,
        source: "company_page",
        meta: {
          company_name: companyName,
        },
      };

      const response = await fetch(`${API}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Не удалось отправить заявку");
      }

      setSent(true);
      setForm(DEFAULT_FORM);
    } catch (err: any) {
      setError(err?.message || "Не удалось отправить заявку");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.Btn} ${styles.BtnNormal}`}
        onClick={() => {
          reset();
          setIsOpen(true);
        }}
      >
        Предложить заказ
      </button>

      {isOpen ? (
        <div className={styles.LeadModalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
          <div className={styles.LeadModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.LeadModalHeader}>
              <div>
                <div className={styles.LeadModalTitle}>Заявка компании</div>
                <div className={styles.LeadModalSubtitle}>{companyName}</div>
              </div>
              <button type="button" className={styles.LeadModalClose} onClick={onClose} aria-label="Закрыть">
                ✕
              </button>
            </div>

            {sent ? (
              <div className={styles.LeadModalSuccess}>
                Спасибо! Мы отправили заявку компании. Они свяжутся с вами в ближайшее время.
              </div>
            ) : (
              <form className={styles.LeadModalForm} onSubmit={onSubmit}>
                <div className={styles.LeadModalGrid}>
                  <label className={styles.LeadModalField}>
                    <span>Имя</span>
                    <input
                      type="text"
                      className={styles.LeadModalInput}
                      value={form.name}
                      onChange={onChange("name")}
                      placeholder="Как к вам обращаться"
                    />
                  </label>
                  <label className={styles.LeadModalField}>
                    <span>Телефон</span>
                    <input
                      type="tel"
                      className={styles.LeadModalInput}
                      value={form.phone}
                      onChange={onChange("phone")}
                      placeholder="+7 (___) ___-____"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </label>
                  <label className={styles.LeadModalField}>
                    <span>Email</span>
                    <input
                      type="email"
                      className={styles.LeadModalInput}
                      value={form.email}
                      onChange={onChange("email")}
                      placeholder="example@mail.ru"
                    />
                  </label>
                  <label className={`${styles.LeadModalField} ${styles.LeadModalFieldWide}`}>
                    <span>Комментарий</span>
                    <textarea
                      className={styles.LeadModalTextarea}
                      value={form.message}
                      onChange={onChange("message")}
                      placeholder="Опишите задачу, сроки или пожелания"
                      rows={4}
                    />
                  </label>
                </div>

                {error ? <div className={styles.LeadModalError}>{error}</div> : null}
                <div className={styles.LeadModalHint}>* Телефон обязателен для связи.</div>

                <div className={styles.LeadModalActions}>
                  <button type="button" className={`${styles.Btn} ${styles.BtnNormal}`} onClick={onClose}>
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className={`${styles.Btn} ${styles.BtnAction}`}
                    disabled={!canSubmit || sending}
                  >
                    {sending ? "Отправка…" : "Отправить"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

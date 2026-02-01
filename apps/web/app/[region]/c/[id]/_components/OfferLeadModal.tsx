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
  agreement: boolean; // ✅ Добавлено поле
};

const DEFAULT_FORM: LeadFormState = {
  name: "",
  phone: "",
  email: "",
  message: "",
  agreement: true, // По умолчанию можно поставить true или false
};

export default function OfferLeadModal({ companyId, companyName }: Props) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<LeadFormState>(DEFAULT_FORM);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (searchParams?.get("offer") === "1") {
      setIsOpen(true);
    }
  }, [searchParams]);

  // ✅ Валидация теперь требует галочку
  const canSubmit = useMemo(() => {
    const hasContact = Boolean(form.phone.trim() || form.email.trim());
    return hasContact && form.agreement;
  }, [form.phone, form.email, form.agreement]);

  const onChange = (key: keyof LeadFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const onToggleAgreement = () => {
    setForm((prev) => ({ ...prev, agreement: !prev.agreement }));
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
      setError("Заполните контакты и подтвердите согласие.");
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
                <div className={styles.SuccessIcon}>✓</div>
                <h3>Заявка отправлена!</h3>
                <p>Компания получила ваше предложение и свяжется с вами в ближайшее время.</p>
                <button className={`${styles.Btn} ${styles.BtnNormal}`} onClick={onClose} style={{marginTop: 20}}>Закрыть</button>
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
                      placeholder="+7 (___) ___-__-__"
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

                {/* ✅ Чекбокс согласия */}
                <label className={styles.LeadModalAgreement}>
                  <input 
                    type="checkbox" 
                    checked={form.agreement} 
                    onChange={onToggleAgreement} 
                  />
                  <span>
                    Я даю согласие на обработку моих персональных данных
                  </span>
                </label>

                {error ? <div className={styles.LeadModalError}>{error}</div> : null}
                <div className={styles.LeadModalHint}>* Укажите телефон или email для связи.</div>

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

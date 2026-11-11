import ParfaitViewer from '@/components/ParfaitViewer';
import { LAYERS } from '@/components/layers';

export default function Page() {
  return (
    <main>
      <header className="top">
        <img src="/brand/logo_lockup_white.svg" alt="منز — مونز نيويورك آيس" className="top-logo" width="154" height="85" />
      </header>

      <section className="hero" aria-labelledby="title">
        <div className="hero-copy">
          <p className="eyebrow">المفضل لمنز</p>
          <h1 id="title">بيري سويرل بارفيه</h1>
          <p className="lede">
            طبقات من آيس كريم الفانيلا وكومبوت التوت والكرامبل المقرمش، تعلوها كريمة مخفوقة وحبة كرز.
            افتح الكوب وشاهد كل طبقة على حدة.
          </p>
          <dl className="facts">
            <div><dt>طبقات</dt><dd>٦</dd></div>
            <div><dt>ارتفاع الكوب</dt><dd>١٨٥<small> ملم</small></dd></div>
            <div><dt>قطر الفوهة</dt><dd>٨٥<small> ملم</small></dd></div>
          </dl>
        </div>
        <ParfaitViewer />
      </section>

      <img src="/brand/wave_divider.svg" alt="" className="wave" aria-hidden="true" />

      <section className="layers" aria-labelledby="layers-title">
        <h2 id="layers-title">ماذا في كل طبقة؟</h2>
        <ol>
          {LAYERS.map((L) => (
            <li key={L.key}>
              <h3>{L.name}</h3>
              <p>{L.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="foot">
        <img src="/brand/badge_round.svg" alt="" width="56" height="56" />
        <p>منز — آيس كريم على طريقة نيويورك</p>
      </footer>
    </main>
  );
}

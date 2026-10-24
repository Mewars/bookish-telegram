import type {Item} from '../types';
import {Icon} from '../components/Icon';
import {MediaImage} from '../components/MediaImage';
import {businessApplicationHash,BUSINESS_MESSAGES_URL} from './model';
import './business.css';

export function BusinessPage({city,items,enabled,goHome}:{city:string;items:Item[];enabled:boolean;goHome:()=>void}) {
 const organizationId=new URLSearchParams(window.location.hash.split('?')[1]).get('organization');
 const organization=items.find(item=>item.real&&item.city===city&&item.kind!=='events'&&item.id===organizationId);
 return <div className="business-page">
  <button type="button" className="business-back" onClick={goHome}><Icon name="back" size={16}/>На главную</button>
  <section className="business-hero" aria-labelledby="business-title">
   <div className="business-intro"><span className="business-eyebrow">РЯДОМ ДЛЯ БИЗНЕСА · {city}</span>
    <h1 id="business-title">Ваш бизнес —<br/><em>рядом с клиентами.</em></h1>
    <p>Помогите жителям найти ваше дело: контакты, услуги и фотографии в городском каталоге.</p>
    <div className="business-actions">{enabled&&<a className="business-button" href={businessApplicationHash(city)}>Добавить бесплатно<Icon name="arrow" size={18}/></a>}<a className="business-link" href={BUSINESS_MESSAGES_URL} target="_blank" rel="noopener noreferrer">Обсудить оформление<Icon name="arrow" size={17}/></a></div>
    <span className="business-hero-note"><Icon name="pin" size={16}/>Ваш город. Ваши клиенты. Ваше дело.</span>
   </div>
   <figure className="business-example"><div className="business-example-photo"><MediaImage src={`${import.meta.env.BASE_URL}brand/discovery/coffee.webp`} alt="Иллюстрация: чашка кофе у окна"/><span>Пример оформления</span></div>
    <figcaption><span className="business-eyebrow">ВАША КАРТОЧКА В РЯДОМ</span><h2>Место для вашего дела</h2><p>Фотография, описание и удобные способы связи.</p><div className="business-example-features"><span><Icon name="pin" size={16}/>Адрес</span><span><Icon name="clock" size={16}/>Часы работы</span><span><Icon name="phone" size={16}/>Контакты</span></div><small>Иллюстрация, не реальная организация</small></figcaption>
   </figure>
  </section>

  <section className="business-offers" aria-labelledby="business-offers-title"><div className="business-section-heading"><span className="business-eyebrow">НАЧНИТЕ С ГЛАВНОГО</span><h2 id="business-offers-title">Выберите, что нужно вашему бизнесу</h2></div>
   <div className="business-offer-grid">
    <article className="business-offer"><Icon name="shop" size={30}/><span className="business-offer-label">РАЗМЕЩЕНИЕ</span><h3>Базовая карточка</h3><strong className="business-price">Бесплатно</strong><p>Чтобы организацию могли найти в своём городе и категории.</p><ul><li>Название, категория и адрес</li><li>Контакты и часы работы</li><li>Описание и фотография</li><li>Ссылка на сайт или ВКонтакте</li></ul>{enabled?<a className="business-outline" href={businessApplicationHash(city)}>Добавить организацию<Icon name="arrow" size={17}/></a>:<p>Приём заявок пока не открыт.</p>}</article>
    <article className="business-offer business-offer-featured"><Icon name="places" size={30}/><span className="business-offer-label">ПОМОЩЬ С ЗАПУСКОМ</span><h3>Оформим за вас</h3><strong className="business-price">Разовая работа</strong><p>Подготовим карточку из ваших материалов. Объём и стоимость согласуем до начала.</p><ul><li>Помощь с описанием</li><li>Подбор предоставленных фотографий</li><li>Проверка контактов и категории</li><li>Согласование перед публикацией</li></ul>{enabled?<a className="business-button" href={businessApplicationHash(city,true)}>Запросить оформление<Icon name="arrow" size={17}/></a>:<a className="business-button" href={BUSINESS_MESSAGES_URL} target="_blank" rel="noopener noreferrer">Обсудить во ВКонтакте<Icon name="arrow" size={17}/></a>}</article>
    <article className="business-offer"><Icon name="services" size={30}/><span className="business-offer-label">ДАЛЬНЕЙШАЯ РАБОТА</span><h3>Поддержка карточки</h3><strong className="business-price">По желанию</strong><p>Обсудим регулярное обновление сведений, когда это потребуется.</p><ul><li>Актуальные контакты и часы работы</li><li>Замена описания и фотографии</li><li>Изменения после проверки</li><li>Условия по договорённости</li></ul><a className="business-outline" href={BUSINESS_MESSAGES_URL} target="_blank" rel="noopener noreferrer">Обсудить поддержку<Icon name="arrow" size={17}/></a></article>
   </div><p className="business-caption">Размещение не требует покупки оформления или подписки. Платные работы начинаются только после согласования; автоматических списаний нет.</p>
  </section>

  <section className="business-process" aria-labelledby="business-process-title"><div className="business-section-heading"><span className="business-eyebrow">ВСЁ ПОНЯТНО ПО ШАГАМ</span><h2 id="business-process-title">От заявки до карточки в каталоге</h2></div><ol>
   <li><span>01</span><h3>Расскажите о себе</h3><p>Укажите город, категорию, контакты и сведения организации.</p></li>
   <li><span>02</span><h3>Мы проверим</h3><p>Модератор проверит данные и фотографию перед публикацией.</p></li>
   <li><span>03</span><h3>Появитесь в каталоге</h3><p>После одобрения карточка появится в соответствующем разделе вашего города.</p></li>
   <li><span>04</span><h3>Оставайтесь на связи</h3><p>Передайте изменения команде РЯДОМ. Они появятся после проверки.</p></li>
  </ol></section>

  <section className="business-existing" aria-labelledby="business-existing-title"><Icon name="profile" size={34}/><div><span className="business-eyebrow">УЖЕ ЕСТЬ В КАТАЛОГЕ?</span><h2 id="business-existing-title">Это ваша организация?</h2>{organization?<><p>Карточка: <strong>{organization.title}</strong> · {organization.city}{organization.address?` · ${organization.address}`:''}.</p><p>При обращении укажите название и город. Мы проверим ваше отношение к организации и согласуем изменения.</p></>:<p>Напишите нам название организации и город. Поможем уточнить сведения и согласовать обновление существующей карточки.</p>}<small>Обращение откроется в сообщениях РЯДОМ во ВКонтакте. Оно не выдаёт права на карточку автоматически.</small></div><a className="business-outline" href={BUSINESS_MESSAGES_URL} target="_blank" rel="noopener noreferrer">Написать в РЯДОМ<Icon name="arrow" size={17}/></a></section>

  <section className="business-faq" aria-labelledby="business-faq-title"><h2 id="business-faq-title">Перед подключением</h2><details><summary>Можно добавить организацию, если я не владелец?</summary><p>Да, житель может предложить публичные сведения с указанием источника. Заявка проходит проверку и не подтверждает владение бизнесом.</p></details><details><summary>Нужно ли платить за появление в каталоге?</summary><p>Нет. Базовое размещение бесплатно. Помощь с оформлением и дальнейшая поддержка обсуждаются отдельно.</p></details><details><summary>Что происходит после отправки заявки?</summary><p>Она поступает на рассмотрение. Статус и причину отказа, если он будет, можно посмотреть в разделе «Мои заявки». До одобрения карточка не публикуется.</p></details><details><summary>Вы гарантируете просмотры и заявки?</summary><p>Нет. Сейчас мы предлагаем размещение и оформление карточки. Охваты, позиции в рейтинге и количество клиентов не гарантируются.</p></details></section>
  <section className="business-final"><span className="business-eyebrow">ВАШЕ ДЕЛО — ЧАСТЬ ГОРОДА</span><h2>Давайте знакомиться.</h2><p>Начните с бесплатной карточки. Остальное обсудим, когда понадобится.</p>{enabled&&<a className="business-button" href={businessApplicationHash(city)}>Подключить организацию<Icon name="arrow" size={19}/></a>}</section>
 </div>;
}

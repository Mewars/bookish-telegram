import { LegalPage } from '../components/legal/LegalPage';
export function OperatorContactsPage({ goBack }: { goBack: () => void }) {
  return <LegalPage title="Контакты и реквизиты" version="CONTACTS-1.2" updatedAt="07.11.2026" goBack={goBack}>
<h2>Владелец сервиса «Scarivo»</h2><p>Евсеев Александр Романович</p><p><strong>Статус:</strong> физическое лицо</p><p><strong>Местонахождение:</strong> г. Енисейск, Красноярский край, Российская Федерация</p><p><strong>E-mail:</strong> <a href="mailto:Mewars@yandex.ru">Mewars@yandex.ru</a></p><p><strong>Сайт:</strong> <a href="https://ryadomcity.ru">https://ryadomcity.ru</a></p><p><strong>ВКонтакте:</strong> <a href="https://vk.ru/mewarspro" target="_blank" rel="noopener noreferrer">vk.ru/mewarspro</a></p>
<p>В вопросах обработки персональных данных владелец выступает оператором до фактически оформленной передачи функций другому лицу. ИНН и дополнительные регистрационные данные будут опубликованы только после их документального подтверждения; ОГРНИП у лица без статуса ИП отсутствует.</p><h2>Обращения</h2><p>По указанному адресу электронной почты можно направлять:</p><ul><li>обращения по вопросам персональных данных;</li><li>запросы на уточнение или удаление данных;</li><li>отзыв согласия;</li><li>сообщения о работе сервиса;</li><li>предложения о сотрудничестве.</li></ul>
</LegalPage>;
}

// Figures transcribed from approved screen 3; Touareg year corrected by the user.
export const cases = [
  {id:'tenet',model:'TENET T4',fuel:'Бензин',year:2025,mileage:27500,route:'город',before:9.0,after:7.8,image:'/assets/cars/tenet-cutout-v1.png',videoUrl:'https://rutube.ru/video/private/42492378f8e001ff1c43a7b461f1d017/?p=zlKy_kAqutFTI4MJBFPE4A'},
  {id:'haval',model:'Haval F7',fuel:'Бензин',year:2026,mileage:5894,route:'смешанный',before:12.1,after:10.1,image:'/assets/cars/haval-cutout-v1.png',videoUrl:'https://rutube.ru/video/private/9904a748e0e7a65f700494f87ae0a567/?p=O6zcP7-jmqDS7A14w7jOcQ'},
  {id:'touareg',model:'Volkswagen Touareg',fuel:'Дизель',year:2008,mileage:152000,route:'трасса',before:14.3,after:10.0,image:'/assets/cars/touareg-cutout-v1.png',videoUrl:'https://rutube.ru/video/private/f0e5225fb533099e9bfe9664cc65b425/?p=mKUo1dJw8Lvr5Dn1CxY0DA'},
  {id:'tucson',model:'Hyundai Tucson',fuel:'Бензин',year:2019,mileage:107000,route:'смешанный',before:9.0,after:6.2,image:'/assets/cars/tucson-cutout-v1.png',videoUrl:'https://rutube.ru/video/private/276083b57df2e2ecee0f3bba97a2ef79/?p=s4ck7iKBIg65xaIqwptuMQ'},
  {id:'exeed',model:'EXEED VX',fuel:'Бензин',year:2024,mileage:50000,route:'трасса',before:10.9,after:8.9,image:'/assets/cars/exeed-cutout-v1.png',imageWidth:1505,imageHeight:1045,videoUrl:'https://rutube.ru/shorts/1641fb1c52b1075b8b1654d245b9407f/'},
  {id:'land-cruiser',model:'Land Cruiser 200',fuel:'Дизель',year:2016,mileage:78000,route:'трасса',before:15.4,after:13.4,image:'/assets/cars/land-cruiser-cutout-v1.png',videoUrl:'https://rutube.ru/video/private/7eb621aa30b616e29243e891a7296aa5/?p=L6z7jbQnxA2lZryfYKCcyg'}
];

export function caseVideoEmbedUrl(videoUrl){
  try{
    const source=new URL(videoUrl);
    const id=source.pathname.match(/^\/(?:video\/(?:private\/)?|shorts\/)([a-f0-9]{32})\/?$/)?.[1];
    if(source.origin!=='https://rutube.ru'||!id)return null;
    const embed=new URL(`https://rutube.ru/play/embed/${id}/`);
    if(source.searchParams.has('p'))embed.searchParams.set('p',source.searchParams.get('p'));
    return embed.href;
  }catch{return null;}
}

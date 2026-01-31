import axios from 'axios';

// No baseURL / no interceptors -> avoids sending API auth headers to S3
const s3PlainAxios = axios.create();

export default s3PlainAxios;

FROM swr.cn-southwest-2.myhuaweicloud.com/wutong/nginx:1.19
COPY dist/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
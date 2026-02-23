MÉTODO PARA ATUALIZAÇÃO

ATENÇÃO FAZER BACKUP ANTES DE QUALQUER ALTERAÇÃO

Extraia o arquivo Multizap.zip e utiliza as pastas backend e frontend para o tutorial.

------------------------------------------------------------------------------------------------------
NO SEU SISTEMA (PELO TERMINAL SSH)

REMOVER AS PASTAT DO BACKEND( MENOS A PUBLIC E .ENV)

cd /home/deploy/empresa01/backend
rm -rf /home/deploy/empresa01/backend/certs
rm -rf /home/deploy/empresa01/backend/dist
rm -rf /home/deploy/empresa01/backend/node_modules
rm -rf /home/deploy/empresa01/backend/src

-----------------------------------

APÓS EXCLUIR AS PASTAS INDICADAS, ARRASTE AS PASTAS DO NOVO SISTEMA(MENOS A PUBLIC)


----------------------------------------------------------------

APÓS FEITO O UPLOAD DAS PASTAS DÊ OS COMANDOS:

npm i && npm run build

npm run db:migrate
---------------------------------------------------------

AGORA DELETAR AS PASTAS DO FRONTEND( MENOS A PUBLIC)
Faça backup da sua pasta ASSETS do SRC, ou já substitua no arquivo novo antes de fazer o upload.
Pode trocar o INDEX da PUBLIC do FRONTEND.

cd /home/deploy/empresa01/frontend
rm -rf /home/deploy/empresa01/frontend/src
rm -rf /home/deploy/empresa01/frontend/node_modules
rm -rf /home/deploy/empresa01/frontend/build
-------------------------------------------------------------

APÓS EXCLUIR AS PASTAS INDICADAS, ARRASTE AS PASTAS DO NOVO SISTEMA(MENOS A PUBLIC e .env)

------------------------------------------------------------
APÓS FEITO O UPLOAD DAS PASTAS DÊ OS COMANDOS:

npm i --f && npm run build


TERMINANDO, ABRA SEU SISTEMA E DÊ UM CONTROL SHIFT R

Pronto....

--------------------------------------------------------------

SE PRECISAR INICIAR O PM2 UTILIZE O ECOSSYSTEM.JS

sudo su deploy

cd /home/deploy/empresa01

pm2 delete empresa01-backend empresa01-frontend

pm2 start ecosystem.config.js

pm2 save

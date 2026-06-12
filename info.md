Application web, utilisant en frontend github pages et en backend google sheets

4 interfaces and Google sheets is like a free and small database

Interface 1:

Formulaire pour saisir le programme des compagnies de contrôle des bureaux régionaux et locaux, chaque bureau selon son accès entre dans le son programme les compagnies: un formulaire en dessous pour ajouter une, et en dessous de ce formulaire un tableau des compagnies déjà ajoutées,...

Interface 2:

D'après cette interface le responsable dans chaque bureau saisie les résultats de chaque compagnie de contrôle

Interface 3:

Le super admin voit un tableau qui collecte toutes les programmes des compagnies de tous les bureaux régionaux et locaux, tableau triable filtrable et exportable en excel ou pdf

Interface 4:

Le super admin voit un tableau qui collecte toutes les info et résultats de chaque compagnie de tous les bureaux régionaux et locaux, tableau triable filtrable et exportable en excel ou pdf

---

Appscript

Mise à jour du déploiement effectuée.
Version 10 du 12 juin 2026, 14:46
ID de déploiement
AKfycbztXxU6nuuIEkCL2sBxU6QNFvcDLv1nWiVU7Woa_6Mc7iXbkcC2jxdVhxGwTVQaQ8Iv
Application Web
URL
https://script.google.com/macros/s/AKfycbztXxU6nuuIEkCL2sBxU6QNFvcDLv1nWiVU7Woa_6Mc7iXbkcC2jxdVhxGwTVQaQ8Iv/exec

google sheets tables structure:

Bureaux (sheet):
Nom_Bureau -> column A
Code_Bureau -> column B
Region -> column C
Nom_Bureau_Ar -> column D

Users (sheet):
Matricule -> column A
FR_Name -> column B
AR_Name -> column C
Grade -> column D
Code_BR -> column E
Pw -> column F

Programmes (sheet):
ID_Programme -> column A
Code_Bureau -> column B
Type_Campagne -> column C
Activite_Zone -> column D
Date_Debut -> column E
Date_Fin -> column F
Nb_Controleurs -> column G

Resultats (sheet):
ID_Resultat -> column A
ID_Programme -> column B
Sal_Aff -> column C
Sal_NonAff -> column D
NonSal_Aff -> column E
NonSal_NonAff -> column F
Trav_Declares -> column G
Trav_NonDeclares -> column H
insuff_totale -> column I
Mt_Reconnu -> column J
Mt_NonReconnu -> column K
Controleurs_participants -> column L
Code_br -> column M
